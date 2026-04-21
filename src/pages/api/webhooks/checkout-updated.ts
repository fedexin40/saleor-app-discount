import { NextApiHandler } from "next";
import { gql } from "urql";
import { createClient } from "../../../lib/create-graphq-client";
import { saleorApp } from "../../../saleor-app";
import { OrdersByEmailDocument } from "../../../../generated/graphql";
import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";
import { TaxableObjectLine } from "../../../../generated/graphql";

const CheckoutCalculateTaxesSubscription = gql`
  subscription CheckoutCalculateTaxes {
    event {
      ... on CalculateTaxes {
        taxBase {
          lines {
            variantName
            sourceLine {
              ... on CheckoutLine {
                id
                quantity
                undiscountedUnitPrice {
                  amount
                }
                undiscountedTotalPrice {
                  amount
                }
                variant {
                  pricing {
                    price {
                      gross {
                        amount
                        currency
                      }
                    }
                  }
                }
              }
            }
          }
          shippingPrice {
            amount
          }
          sourceObject {
            ... on Checkout {
              id
              email
            }
          }
        }
      }
    }
  }
`;

// =========================
// Queries / Mutations against Saleor API
// =========================
const OrdersByEmail = gql`
  query OrdersByEmail($email: String!) {
    orders(first: 1, where: { userEmail: { eq: $email } }) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const CheckoutLinesUpdate = gql`
  mutation CheckoutLinesUpdate($checkoutId: ID!, $lines: [CheckoutLineUpdateInput!]!) {
    checkoutLinesUpdate(id: $checkoutId, lines: $lines) {
      checkout {
        id
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

function applyPercentageDiscount(amount: number, percent: number) {
  const discounted = amount * (1 - percent / 100);
  return Number(discounted.toFixed(2));
}

export const checkoutUpdatedWebhook = new SaleorSyncWebhook<any>({
  name: "Checkout updated",
  webhookPath: "api/webhooks/checkout-updated",
  event: "CHECKOUT_CALCULATE_TAXES",
  apl: saleorApp.apl,
  query: CheckoutCalculateTaxesSubscription,
});

const checkoutUpdatedHandler: NextApiHandler = async (req, res) => {
  let domain = new URL(process.env.NEXT_PUBLIC_SALEOR_HOST_URL || "");
  req.headers["saleor-domain"] = `${domain.host}`;
  req.headers["x-saleor-domain"] = `${domain.host}`;

  const saleorApiUrl = process.env.NEXT_PUBLIC_SALEOR_HOST_URL + "/graphql/";
  req.headers["saleor-api-url"] = saleorApiUrl;

  return checkoutUpdatedWebhook.createHandler(async (req, res, ctx) => {
    console.log("webhook received");
    let discountPercent = 0
    let freeShipping = false

    const { payload, authData, event } = ctx;

    const taxBase = payload?.taxBase;

    const client = createClient(authData.saleorApiUrl, async () => ({
      token: authData.token,
    }));

    if (!taxBase) {
      return res.status(200).end();
    }

    const checkoutTotal =
      taxBase.lines.reduce((acc: any, line: any) => {
        const amount = line.sourceLine.variant.pricing.price.gross.amount ?? 0;
        return acc + amount * line.sourceLine.quantity;
      }, 0) ?? 0;

    const email = taxBase.sourceObject.email?.trim().toLowerCase();
    // El email puede venir vacío al inicio del checkout
    if (email) {
      const ordersbyEmail = await client.query(OrdersByEmailDocument, {
        email: email
      })

      if (ordersbyEmail.data?.orders?.edges.length == 0 ){
        console.log(`El email ${email} no tiene órdenes. Es primera compra.`);
        discountPercent = 10
      }
    } else {
      discountPercent = 10
    }

    if (checkoutTotal >= 5000 && checkoutTotal < 10000){
      discountPercent = 15
    }
    else if (checkoutTotal >= 10000) {
      discountPercent = 20
    }

    const checkoutTotalDiscount = applyPercentageDiscount(checkoutTotal || 0,discountPercent)
    if ( checkoutTotalDiscount > 1000){
      freeShipping = true
    }

    const result = {
      shipping_tax_rate: "0",
      shipping_price_gross_amount: freeShipping ? 0 : taxBase.shippingPrice.amount,
      shipping_price_net_amount: freeShipping ? 0 : taxBase.shippingPrice.amount,
      lines: taxBase.lines.map((line: TaxableObjectLine) => {
        const undiscounted = line.sourceLine.variant ? line.sourceLine.variant.pricing?.price?.gross.amount : 0
        const expectedPrice = applyPercentageDiscount(
          undiscounted || 0,
          discountPercent
        )
        const gross = expectedPrice || 0;
        const net = gross * 0.84;

        return {
          tax_rate: "16",
          total_gross_amount: gross * line.sourceLine.quantity,
          total_net_amount: net * line.sourceLine.quantity,
        };
      }),
    }
    console.log('Event handled')
    return res.status(200).json(result);
  })(req, res);
};

export default checkoutUpdatedHandler;

export const config = {
  api: {
    bodyParser: false,
  },
};
