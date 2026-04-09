const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");

async function run() {
  const model = await tf.loadLayersModel(
    "file://./nexora_ai_model.keras"
  );

  await model.save("file://./public/model");

  console.log("🔥 WEB MODEL READY 293");
}

run();