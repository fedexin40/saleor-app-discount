import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";

import { saleorApp } from "../../saleor-app";
import type { NextApiHandler } from "next";

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 */
// export default createAppRegisterHandler({
//   apl: saleorApp.apl,
//   allowedSaleorUrls: [
//     /**
//      * You may want your app to work only for certain Saleor instances.
//      *
//      * Your app can work for every Saleor that installs it, but you can
//      * limit it here
//      *
//      * By default, every url is allowed.
//      *
//      * URL should be a full graphQL address, usually starting with https:// and ending with /graphql/
//      *
//      * Alternatively pass a function
//      */
//   ],
// });

const registerHandler: NextApiHandler = async (req, res) => {
  // console.log({ req });

  let domain = new URL(process.env.NEXT_PUBLIC_SALEOR_HOST_URL || "");
  req.headers["saleor-domain"] = `${domain.host}`;
  req.headers["x-saleor-domain"] = `${domain.host}`;

  const saleorApiUrl = process.env.NEXT_PUBLIC_SALEOR_HOST_URL + "/graphql/";
  req.headers["saleor-api-url"] = saleorApiUrl;

  // console.log({ req });
  return createAppRegisterHandler({
    apl: saleorApp.apl,
    allowedSaleorUrls: [
      (url) => {
        console.log({ url });
        return true;
      },
    ],
    // async onRequestStart(request, context) {
    //   console.log({ request, context });
    // },
    // async onAplSetFailed(error, context) {
    //   console.log({ context });
    // },
  })(req, res);
};

export default registerHandler;
