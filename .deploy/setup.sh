#!/bin/bash

cp mirror-*.service /etc/systemd/system/
cp mirror-*.conf /etc/logrotate.d/
cp mirror-logging.yml /etc/newrelic-infra/logging.d/
systemctl daemon-reload
