#!/bin/bash

# Set up logging
cp mirror-*.conf /etc/logrotate.d/
cp mirror-logging.yml /etc/newrelic-infra/logging.d/

# Set up systemd
cp mirror-*.service /etc/systemd/system/
systemctl daemon-reload
