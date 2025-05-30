const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const redis = require("redis");

const PROTO_PATH = __dirname + "/external.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const externalscaler = protoDescriptor.externalscaler; // ใหม่

const client = redis.createClient({
  url: "redis://" + process.env.REDIS_ENDPOINT + ":6379",
});
client.connect().catch(console.error);

const QUEUE_LOCK_KEY = "lock:deploy-queue";
const ACTIVE_LOCK_KEY = "lock";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

// pod has scale
async function isActive(call, callback) {
  try {
    await randomDelay(500, 2000);

    const serviceValue = call?.request?.scalerMetadata?.serviceValue || "";
    console.log("isActive-" + serviceValue);

    const pod = await client.get(ACTIVE_LOCK_KEY + ":" + serviceValue);
    const locked = await client.get(QUEUE_LOCK_KEY);
    let result = false;

    if (pod) {
      result = true;
    }
    if (!pod && !locked) {
      console.log("isActive not found pod");
      await client.set(ACTIVE_LOCK_KEY + ":" + serviceValue, "1", {
        NX: true,
      });

      await client.set(QUEUE_LOCK_KEY, "1", {
        NX: true,
        EX: 60,
      });
      result = true;
    }
    callback(null, { result });
  } catch (err) {
    console.log(err);
    callback(err, null);
  }
}

function streamIsActive(call) {
  call.end();
}

async function getMetricSpec(call, callback) {
  try {
    console.log("call getMetricSpec");

    const resp = {
      metric_specs: [
        {
          metric_name: "lock-metric",
          target_size: 1,
        },
      ],
    };
    callback(null, resp);
  } catch (err) {
    callback(err, null);
  }
}
async function getMetrics(call, callback) {
  console.log("getMetrics");

  const locked = await client.get(QUEUE_LOCK_KEY);
  metricValue = locked ? 1 : 0;

  callback(null, {
    metric_values: [{ metric_name: "lock-metric", metric_value: metricValue }],
  });
}

function main() {
  const server = new grpc.Server();
  server.addService(externalscaler.ExternalScaler.service, {
    IsActive: isActive,
    StreamIsActive: streamIsActive,
    GetMetricSpec: getMetricSpec,
    GetMetrics: getMetrics,
  });

  const port = process.env.PORT || "50051";
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`gRPC scaler running on port ${port}`);
      server.start();
    },
  );
}

main();
