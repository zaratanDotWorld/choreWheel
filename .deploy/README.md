# Deploy Notes

This directory contains the various configuration files used to deploy the repo
to a remote server (e.g. an AWS EC2 instance). When setting up a new server,
ensure that `nodejs`, `npm`, and `nvm` are installed and that `node` is set to
the version described in `.nvmrc`. The following commands should work on a new
Ubuntu instance:

```
# Set up the server environment
sudo apt update
sudo apt install nodejs npm
curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
source ~/.bashrc

# Set up the repository
git clone https://github.com/kronosapiens/mirror.git
cd mirror
nvm use
npm i
```

Now create a `.env` file with the necessary secret information,
and set up the various configuration files as described below.

#### `mirror-chores.service`

The `systemd` config file for running the Chores app. Sudo copy this file to `/etc/systemd/system/`
and run `systemctl daemon-reload` to load the configuration file, and run `mkdir logs` in
the root directory of the repository to set up the logs folder. The service can then be
managed using `systemctl {start, stop, restart, status} mirror-chores` as needed. In order
to run these commands, you must explicitly set a password for the user. This can be done
using `sudo passwd <username>`.

#### `mirror-chores`

The `logrotate` config file for the Chores app, used to manage log rotation
and preserve the memory of the EC2 instance. Sudo copy this file to `/etc/logrotate.d/`.
Ultimately the instance logs don't matter since the logs are transferred to
Cloudwatch, we just don't want the logs clunking up the instance.

#### `logging.yml`

We use New Relic for application monitoring. Application logs are exported to
New Relic's service using the configuration found in this file. Copy this file
to `/etc/newrelic-infra/logging.d/` to begin exporting logs.
