#!/bin/bash              
URL=https://api.infect.info/rda/v2/rda.data
STATUS=$(curl -s -o /dev/null -w "%{http_code}\n" -m 30 $URL)

if [ $STATUS == 200 ] ; then
    URL=https://api.infect.info/core-data/v1/pathogen.bacterium
    STATUS=$(curl -s -o /dev/null -w "%{http_code}\n" -m 30 $URL)
fi

if [ $STATUS == 200 ] ; then
    URL=https://api.vet.infect.info/rda/v2/rda.data
    STATUS=$(curl -s -o /dev/null -w "%{http_code}\n" -m 30 $URL)
fi

if [ $STATUS == 200 ] ; then
    URL=https://api.vet.infect.info/core-data/v1/pathogen.bacterium
    STATUS=$(curl -s -o /dev/null -w "%{http_code}\n" -m 30 $URL)
fi



# dont restart while rda is restarted in the nigth
current=$(date '+%H%M')
if [ "$current" -gt "0340" ] ; then
    if [ "$current" -lt "0409" ] ; then
        echo "sleeping for 30 minutes since tha cluster is being restarted by cron"
        sleep 1800
    fi
fi

if [ $STATUS == 200 ] ; then
  echo "$URL is up, returned $STATUS"
else                     
  echo "$URL is down, returned $STATUS"

  systemctl restart rda
  sleep 60

  cd /home/ubuntu/apps/beta-ship && /usr/bin/node --max-old-space-size=16000 --experimental-modules --no-warnings --experimental-vm-modules src/createCluster.js --prod --vet --log-level=error+ --log-module=* 2>&1 | /usr/bin/logger -t RDA
  sleep 60

  cd /home/ubuntu/apps/beta-ship && /usr/bin/node --max-old-space-size=16000 --experimental-modules --no-warnings --experimental-vm-modules src/createCluster.js --prod --log-level=error+ --log-module=* 2>&1 | /usr/bin/logger -t RDA
  sleep 600
fi

# dont check more than once a minute
sleep 60

## systemd will restart teh script
#ScriptLoc=$(readlink -f "$0")
#exec "$ScriptLoc"