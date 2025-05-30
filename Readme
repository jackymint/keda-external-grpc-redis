# keda-external-grpc-redis

A gRPC External Scaler for [KEDA](https://keda.sh) that uses Redis locks to control Kubernetes pod scaling.

---

## Overview

This project implements a gRPC External Scaler for KEDA that leverages Redis keys as distributed locks to coordinate pod scaling decisions in Kubernetes.

- Redis keys used:
  - `lock:deploy-queue`: queue lock to serialize scaling events
  - `lock:<serviceValue>`: active pod lock per service or deployment prefix
- Implements gRPC ExternalScaler interface methods:
  - `IsActive`
  - `StreamIsActive`
  - `GetMetricSpec`
  - `GetMetrics`
- Introduces random delay (500-2000 ms) before responding to reduce contention
- Uses `serviceValue` metadata from KEDA triggers to isolate locks per deployment

---

## Deployment

The scaler is packaged as a Docker container and designed to run on Kubernetes clusters. You can deploy it using Skaffold, Helm, or any Kubernetes deployment method.

---

## Example KEDA ScaledObject

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: example-scaledobject
spec:
  scaleTargetRef:
    name: your-target-deployment
  pollingInterval: 15          # How often to check metrics (seconds)
  cooldownPeriod: 30           # How long to wait after scale down (seconds)
  minReplicaCount: 0
  maxReplicaCount: 5
  triggers:
  - type: external
    metadata:
      scalerAddress: redis-grpc-scaler-svc.default.svc.cluster.local:50051
      serviceValue: example-service
