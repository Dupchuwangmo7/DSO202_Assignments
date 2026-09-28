# DSO202 — Assignment 2: Applying Unit II Concepts to the Task Tracker

Continuation of Assignment 1. The application (frontend, backend, database
images and their APIs, schema and environment variables) is **unchanged**;
only the Kubernetes layer is improved using Unit II concepts.

> Status: Stages A (StatefulSet) and B (RBAC) written; Stage A verified on a live cluster. Sections marked
> **TODO** are completed as each stage is implemented and verified.

## 1. Analysis of the existing application

| Component | Technology | State | Port | Configuration |
|---|---|---|---|---|
| Frontend | nginx, static single-page UI | Stateless | 8080 | `BACKEND_URL` rendered into `config.js` at container start |
| Backend | Node.js 22, Express, `pg` | Stateless | 8080 | `DB_*`, `APP_PORT`, `CORS_ORIGIN` |
| Database | PostgreSQL 17 + seed script | **Stateful** | 5432 | `POSTGRES_*`; data in `/var/lib/postgresql/data` |

Findings that drive the design:

1. The frontend's JavaScript runs in the **browser** and calls
   `${BACKEND_URL}/api/...` directly. The frontend Pod never talks to the
   backend Pod. In Assignment 1, `BACKEND_URL` was the cluster-internal name
   `backend-svc`, which a browser outside the cluster cannot resolve — the UI
   showed "Backend unreachable" (Assignment 1, Task 7a note).
2. The only service-to-service call inside the cluster is backend → database (TCP 5432).
3. The application has no authentication and no auth service.
4. No container calls the Kubernetes API.

## 2. Mapping Unit II concepts to this project

| Concept | Applicable? | Where | Why |
|---|---|---|---|
| StatefulSet | Yes | Database only | Only stateful workload; needs stable identity and per-Pod storage. Frontend/backend remain Deployments. |
| Ingress | Yes | `/` → frontend, `/api` → backend | Fixes finding 1: one browser-reachable address routes to both tiers. **TODO** |
| RBAC | Yes (small) | Per-workload ServiceAccounts; Roles for human users | Pods need no API access, so workload ServiceAccounts get no permissions; the real use is scoping what people can do. |
| Operator | Partly | Existing PostgreSQL operator, demonstration only | A custom operator would be unjustified complexity. **TODO** |
| Istio | Marginal | Demonstration only | One internal hop; limited benefit for three services. **TODO** |

## 3. StatefulSet (database)

Files: `k8s/services/db-svc.yaml`, `k8s/statefulsets/db-statefulset.yaml`

**Why not the Assignment 1 Deployment:** a Deployment gives Pods random names
and its rolling update can briefly run a new Pod alongside the old one against
the same volume. A StatefulSet gives the Pod a stable name (`db-0`), stable
DNS (`db-0.db-svc`), and its own PersistentVolumeClaim created from
`volumeClaimTemplates` (`data-db-0`) that is re-attached whenever `db-0` is
recreated.

**Key settings**

| Setting | Value | Reason |
|---|---|---|
| `serviceName` | `db-svc` (headless, `clusterIP: None`) | Governing Service that provides per-Pod DNS |
| `replicas` | 1 | No replication is configured; extra replicas would be independent, unsynchronised databases |
| `volumeClaimTemplates` | 1Gi, `ReadWriteOnce`, default StorageClass | One PVC per Pod, not shared |
| `updateStrategy` | `RollingUpdate`, `partition: 0` | Default; Pods updated one at a time in reverse ordinal order |
| `persistentVolumeClaimRetentionPolicy` | `Retain` on delete and scale | Deleting or scaling the StatefulSet never deletes data |
| `PGDATA` | `/var/lib/postgresql/data/pgdata` | Data in a subdirectory of the mount avoids initialisation errors on volumes with pre-existing content |

**Application compatibility:** the backend still uses `DB_HOST=db-svc`.
Because `db-svc` is headless it resolves directly to the `db-0` Pod IP, so no
application setting changed.

**Evidence**

Persistence test: a task was created, the database Pod deleted, and the task
was still present afterwards. The seed rows kept their original `created_at`
(`10:34:43`), so the database was not re-initialised.

```
$ curl -X POST http://localhost:8081/api/tasks -H "Content-Type: application/json" \
    -d '{"title":"survives db-0 deletion","status":"pending"}'
{"id":4,"title":"survives db-0 deletion","description":null,"status":"pending","created_at":"2026-09-28T10:41:46.257Z"}

$ kubectl delete pod db-0 -n dso202-assignment-02
pod "db-0" deleted from dso202-assignment-02 namespace

$ kubectl get pods -n dso202-assignment-02 --watch
NAME   READY   STATUS              RESTARTS   AGE
db-0   0/1     ContainerCreating   0          0s
db-0   1/1     Running             0          0s          <- same name

$ curl http://localhost:8081/api/tasks        # task 4 still listed alongside seed tasks 1-3

$ kubectl get pod,pvc -n dso202-assignment-02
pod/db-0                        1/1     Running   0          102s     <- Pod is new
persistentvolumeclaim/data-db-0 Bound  pvc-216af4ae-d101-42e3-9063-573af0f40311  1Gi  RWO  standard  15m   <- volume is not
```

Stable identity and DNS (the Pod IP may change on recreation; the name does not):

```
$ kubectl get pod db-0 -o wide          ->  IP 10.244.0.9
$ kubectl get endpoints db-svc          ->  10.244.0.9:5432
$ nslookup db-0.db-svc.dso202-assignment-02.svc.cluster.local   ->  10.244.0.9
$ nslookup db-svc.dso202-assignment-02.svc.cluster.local        ->  10.244.0.9
```

Note: `nslookup db-0.db-svc` (short name) returned NXDOMAIN from inside the
backend Pod, while the fully-qualified names resolve. This is most likely the
BusyBox resolver in the Alpine-based backend image not applying the cluster
search domains; this was not investigated further.

## 4. Ingress — TODO
## 5. RBAC

Files: `k8s/rbac/serviceaccounts.yaml`, `user-serviceaccounts.yaml`,
`roles.yaml`, `rolebindings.yaml`. All objects are namespaced; no
ClusterRole or ClusterRoleBinding is used because every resource involved
lives in `dso202-assignment-02`, and `cluster-admin` is not used.

| ServiceAccount | Used by | Access | Verbs | Namespace |
|---|---|---|---|---|
| `frontend-sa`, `backend-sa`, `db-sa` | The three workloads | None (no Role bound, token not mounted) | none | n/a |
| `viewer-sa` | A person who only needs to look (e.g. a reviewer) | Pods, logs, Services, endpoints, ConfigMaps, PVCs, events, Deployments, StatefulSets, ReplicaSets, Ingresses | get, list, watch | `dso202-assignment-02` only |
| `deployer-sa` | A person who releases changes | Deployments, StatefulSets, Services, ConfigMaps, Ingresses (full write); Pods (read + delete); PVCs and logs (read only) | see `roles.yaml` | `dso202-assignment-02` only |

Deliberately withheld from both human roles: `secrets` (credentials),
`pods/exec` (a shell in a container can read its environment, including
credentials), and, for `deployer-sa`, deletion of PVCs (which would destroy
database data).

**Evidence (TODO — paste real `kubectl auth can-i` output):**

```
<paste>
```

## 6. Operators — TODO
## 7. Istio — TODO
## 8. Secret encoding caveat

Kubernetes Secrets are base64-encoded, not encrypted at rest by default
(unchanged from Assignment 1).

## 9. Deployment order and troubleshooting — TODO (finalised after all stages)
