const { exec } = require("./dockerEngine");
const { ensureKeypair } = require("./keys");

async function setupSSH(containerName, username) {
    const { publicKey } = await ensureKeypair(username);

    const script = `
        set -e

        if command -v apt-get >/dev/null 2>&1; then
        apt-get update -y
        apt-get install -y openssh-server sudo ca-certificates
        elif command -v apk >/dev/null 2>&1; then
        apk add --no-cache openssh sudo ca-certificates
        fi

        mkdir -p /var/run/sshd

        id -u ${username} >/dev/null 2>&1 || useradd -m -s /bin/bash ${username}
        echo "${username} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${username}
        chmod 440 /etc/sudoers.d/${username}

        mkdir -p /home/${username}/.ssh
        chmod 700 /home/${username}/.ssh
        echo "${publicKey}" >> /home/${username}/.ssh/authorized_keys
        chmod 600 /home/${username}/.ssh/authorized_keys
        chown -R ${username}:${username} /home/${username}/.ssh

        sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config || true
        sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config || true

        /usr/sbin/sshd || sshd
        `;

    await exec(containerName, ["sh", "-lc", script]);
    return true;
}

module.exports = { setupSSH };
