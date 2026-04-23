import { NextApiHandler } from "next";
import { gql } from "urql";
import { saleorApp } from "../../../saleor-app";
import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";
import { TaxableObjectLine } from "../../../../generated/graphql";

const CheckoutCalculateTaxesSubscription = gql`
  subscription CheckoutCalculateTaxes {
    event {
      ... on CalculateTaxes {
        taxBase {
          lines {
            totalPrice {
              amount
            }
          }
          shippingPrice {
            amount
          }
          discounts {
            amount {
              amount
            }
            name
            type
          }
        }
      }
    }
  }
`;

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
    let freeShipping = false

    const { payload, authData, event } = ctx;

    const taxBase = payload?.taxBase;
    const discounts = taxBase.discounts || [];

    if (!taxBase) {
      return res.status(200).end();
    }

    const discountsTotal = discounts.reduce((acc : any, x: any) => acc + x.amount?.amount || 0, 0);
    const checkoutTotal = taxBase.lines.reduce((acc : any, line: any) => acc + Number(line.totalPrice?.amount || 0), 0);
    const checkoutTotalWithDiscount = checkoutTotal - discountsTotal

    if ( checkoutTotalWithDiscount > 1000){
      freeShipping = true
    }

    const result = {
      shipping_tax_rate: "0",
      shipping_price_gross_amount: freeShipping ? 0 : taxBase.shippingPrice.amount,
      shipping_price_net_amount: freeShipping ? 0 : taxBase.shippingPrice.amount,
      lines: taxBase.lines.map((line: TaxableObjectLine) => {
        const gross = discountsTotal > 0 ? line.totalPrice.amount - discountsTotal * (line.totalPrice.amount/checkoutTotal) : line.totalPrice.amount
        return {
          tax_rate: "16",
          total_gross_amount: gross,
          total_net_amount: gross * 0.84,
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
