# Deploy Notes

This directory contains the various configuration files used to deploy the repo
to a remote server (e.g. an AWS EC2 instance).

#### `mirror-chores.service`

The `systemd` config file for running the Chores app. Copy this file to `/etc/systemd/system/`
and run `systemctl daemon-reload` to load the configuration file, and run `mkdir logs` in
the root directory of the repository to set up the logs folder. The service can then be
managed using `systemctl {start, stop, restart, status} mirror-chores` as needed.

#### `mirror-chores`

The `logrotate` config file for the Chores app, used to manage log rotation
and preserve the memory of the EC2 instance. Copy this file to `/etc/logrotate.d/`.
Ultimately the instance logs don't matter since the logs are transferred to
Cloudwatch, we just don't want the logs clunking up the instance.

#### `logging.yml`

We use New Relic for application monitoring. Application logs are exported to
New Relic's service using the configuration found in this file. Copy this file
to `/etc/newrelic-infra/logging.d/` to begin exporting logs.
