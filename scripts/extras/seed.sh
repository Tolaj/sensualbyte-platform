#!/bin/sh
set -e

# ==========================
# CONFIG
# ==========================
API_CONTAINER="infra-api-1"       # Name of your API container
DB_NAME="sensualbyte_platform"
ADMIN_EMAIL="admin@sensualbyte.com"
ADMIN_PASSWORD="Admin@123"
ADMIN_ROLE="super_admin"

echo "🚀 Seeding admin user inside container $API_CONTAINER..."

# ==========================
# RUN INLINE NODE SCRIPT INSIDE CONTAINER
# ==========================
docker exec -i $API_CONTAINER node <<EOF
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

(async () => {
  const client = new MongoClient('mongodb://mongo:27017/$DB_NAME');
  await client.connect();
  const db = client.db();

  const passwordHash = await bcrypt.hash('$ADMIN_PASSWORD', 10);
  console.log('🔐 Password hashed:', passwordHash);

  await db.collection('users').insertOne({
    email: '$ADMIN_EMAIL',
    passwordHash,
    role: '$ADMIN_ROLE',
    active: true,
    createdAt: new Date()
  });

  console.log('✅ Admin user seeded');
  await client.close();
})();
EOF

echo "🎉 Done!"
