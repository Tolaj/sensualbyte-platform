read -p "Enter public domain (ecs.yourdomain.com): " DOMAIN
curl -I https://$DOMAIN
