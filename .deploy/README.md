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
git clone https://github.com/zaratanDotWorld/choreWheel.git
cd choreWheel
mkdir logs
nvm install
npm install
```

Now create a `.env` file with the necessary secret information,
and set up the various configuration files as described below,
or `cd` into this directory and run `sudo ./setup.sh`.

#### `mirror-*.service`

The `systemd` config file for running the apps.

Run `sudo cp .deploy/mirror-*.service /etc/systemd/system/` and then
`systemctl daemon-reload` to load the configuration file. The service can then
be managed using `systemctl {start, stop, restart, status} mirror-*` as needed.

In order to run these commands, you must explicitly set a password for the
user. This can be done using `sudo passwd <username>`.

#### `mirror-*.conf`

The `logrotate` config files for the apps, used to manage log rotation
and preserve the memory of the EC2 instance.

Run `sudo cp .deploy/mirror-*.conf /etc/logrotate.d/`.

#### `mirror-logging.yml`

We use New Relic for application monitoring. Application logs are exported to
New Relic's service using the configuration found in this file.

Run `sudo cp .deploy/mirror-logging.yml /etc/newrelic-infra/logging.d/`
to begin exporting logs.
