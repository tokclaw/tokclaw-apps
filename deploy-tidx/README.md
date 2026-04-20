# TIDX Deployment for Tokclaw Blockchain

## Chain Information

- **Chain ID**: 7447
- **RPC URL**: https://rpc.tokclaw.com/
- **Chain Name**: Tokclaw

## Quick Start

### 1. Setup Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env and set your secure password
nano .env
```

### 2. Make init script executable

```bash
chmod +x init-db.sh
```

### 3. Start Services

```bash
docker compose up -d
```

### 4. Check Logs

```bash
# View all logs
docker compose logs -f

# View TIDX logs only
docker compose logs -f tidx

# Check sync status
docker compose exec tidx tidx status --watch
```

### 5. Test API

```bash
# Query blocks count
curl "http://localhost:8080/query?chainId=7447&sql=SELECT COUNT(*) FROM blocks"

# Query latest block
curl "http://localhost:8080/query?chainId=7447&sql=SELECT MAX(block_num) FROM blocks"
```

## Services

| Service    | Port       | Description          |
| ---------- | ---------- | -------------------- |
| PostgreSQL | 5432       | OLTP database        |
| ClickHouse | 8123, 9000 | OLAP database        |
| TIDX API   | 8080       | Indexer HTTP API     |
| Prometheus | 9090       | Metrics (if enabled) |

## Configuration

### config.toml

Main configuration file for TIDX indexer:

- Chain settings (chain_id, rpc_url, pg_url)
- HTTP server settings
- ClickHouse integration

### Environment Variables

- `POSTGRES_PASSWORD`: PostgreSQL password
- `RUST_LOG`: Logging level (default: tidx=info)
- `RUST_LOG_FORMAT`: Log format (default: pretty)

## Troubleshooting

### Check sync progress

```bash
# Compare with actual chain height
curl -X POST https://rpc.tokclaw.com/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check indexed blocks
curl "http://localhost:8080/query?chainId=7447&sql=SELECT MAX(block_num) FROM blocks"
```

### Restart services

```bash
docker compose restart
```

### Reset everything

```bash
docker compose down -v
docker compose up -d
```

## Monitoring (Optional)

To enable Prometheus and Grafana:

```bash
docker compose --profile monitoring up -d
```

Access:

- Prometheus: http://localhost:9091
- Grafana: http://localhost:3000

## Production Deployment

For production use:

1. Set strong passwords in `.env`
2. Configure firewall (allow only ports 8080, 22)
3. Setup reverse proxy (Nginx) with SSL
4. Configure `trusted_cidrs` in config.toml
5. Setup automated backups for PostgreSQL
6. Monitor disk space usage

## Next Steps

After TIDX is synced:

1. Configure basic auth for TIDX API
2. Update explorer app to use your TIDX endpoint
3. Deploy explorer to Cloudflare Workers
