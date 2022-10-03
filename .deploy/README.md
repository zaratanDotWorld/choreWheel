# Deploy Notes

This directory contains the various configuration files used to deploy the repo
to a remote server (e.g. an AWS EC2 instance).

## `mirror-chores.service`

The `systemd` config file for running the Chores app. Copy this file to `/etc/systemd/` and
run `systemctl reload mirror-chores` to load the configuration file. The service can then
be managed using `systemctl {start, stop, restart, status} mirror-chores` as needed.

## `mirror-chores`

The `logrotate` config file for the Chores app, used to manage log rotation
and preserve the memory of the EC2 instance. Copy this file to `/etc/logrotate.d/`.
Ultimately the instance logs don't matter since the logs are transferred to
Cloudwatch, we just don't want the logs clunking up the instance.

## `cloudwatch-agent.json`

The configuration file used to configure the AWS Cloudwatch Agent to transfer
logs to the Cloudwatch service for easier access (without having to ssh into the instance).
See [here](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/install-CloudWatch-Agent-on-EC2-Instance-fleet.html) for relevant AWS documentation.
