const { execCmd } = require("./docker");
const { ensureKeypair } = require("./keys");

async function setupSSH(containerName, username) {
    const { publicKey } = await ensureKeypair(username);

    // Install SSH + create user + add key
    const script = `
set -e

apt-get update -y
apt-get install -y openssh-server sudo ca-certificates

mkdir -p /var/run/sshd

id -u ${username} >/dev/null 2>&1 || useradd -m -s /bin/bash ${username}

echo "${username} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/${username}
chmod 440 /etc/sudoers.d/${username}

mkdir -p /home/${username}/.ssh
chmod 700 /home/${username}/.ssh
echo "${publicKey}" >> /home/${username}/.ssh/authorized_keys
chmod 600 /home/${username}/.ssh/authorized_keys
chown -R ${username}:${username} /home/${username}/.ssh

# Ensure sshd allows pubkey auth
sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

service ssh start || /usr/sbin/sshd
`;

    // Execute inside container
    await execCmd("docker", ["exec", "-i", containerName, "bash", "-lc", script]);
    return true;
}

module.exports = { setupSSH };
