#!/bin/bash
# Assumes that you start in /c/projects/HSAdmin
projname=extension
projdir=~/cs/jam/$projname

#1 Specify the path where the chrome.manifest and install.rdf files live in the {69103309-20A6-42CB-9B76-26D9595604FF} file (should be C:\projects\HSAdmin\project\).
cat documentation/\{69103309-20A6-42CB-9B76-26D9595604FF\}

#2 Delete the non-local extension if it exists.
rm -f ~/.mozilla/firefox/qjsdmy6u.default-1422481910445/extensions/\{69103309-20A6-42CB-9B76-26D9595604FF\}.xpi

#3 Copy the test extension pointer file to the extensions dir.
cp documentation/\{69103309-20A6-42CB-9B76-26D9595604FF\} ~/.mozilla/firefox/qjsdmy6u.default-1422481910445/extensions

#4 Edit extensions.cache and remove any references to the app ID.
sed -i '/{69103309-20A6-42CB-9B76-26D9595604FF}/ d' ~/.mozilla/firefox/qjsdmy6u.default-1422481910445/extensions.cache

#5 Restart Firefox.
