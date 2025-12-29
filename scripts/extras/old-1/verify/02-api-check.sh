echo "🔐 Checking auth endpoint"
curl -s http://localhost:8080/api/auth/login | jq .
