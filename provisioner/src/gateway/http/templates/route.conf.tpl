server {
  listen 80;
  server_name __HOSTNAME__;

  location / {
    proxy_pass http://__TARGET_IP__:__TARGET_PORT__;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
