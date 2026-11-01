import {onRequest} from "firebase-functions/v2/https";
import {createApp} from "./server.mjs";

export const weatherBriefingTts=onRequest({
  region:"asia-northeast3",
  cors:false,
  timeoutSeconds:30,
  memory:"512MiB",
  minInstances:0,
  maxInstances:3,
  concurrency:20,
  invoker:"public",
},createApp());
