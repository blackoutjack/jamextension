#!/bin/bash
projname=extension
projdir=~/cs/jam/$projname

#1 Specify the path where the chrome.manifest and install.rdf files live
# in the jam-extension@policy-weaving.cs.wisc.edu file.
cat $projdir/doc/jam-extension@policy-weaving.cs.wisc.edu

#2 Delete the non-local extension if it exists.
rm -f ~/.mozilla/firefox/qjsdmy6u.default-1422481910445/extensions/jam-extension@policy-weaving.cs.wisc.edu.xpi

#3 Copy the test extension pointer file to the extensions dir.
cp $projdir/doc/jam-extension@policy-weaving.cs.wisc.edu ~/.mozilla/firefox/qjsdmy6u.default-1422481910445/extensions/

#4 Edit extensions.cache and remove any references to the app ID.
#sed -i '/jam-extension@policy-weaving.cs.wisc.edu/ d' ~/.mozilla/firefox/qjsdmy6u.default-1422481910445/extensions.cache

#5 Restart Firefox.
