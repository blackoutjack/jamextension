#!/bin/bash

# !!! edit install.rdf to indicate new version number
# %%% Take version number as input and use sed to change install.rdf.

projname=extension
projdir=~/cs/jam/$projname
jarname=jam-extension
cmpdir=$projdir/compile

# copy the 'src' folder to a new one called 'compile'
rm -rf $cmpdir
cp -r $projdir/src $cmpdir
# save appropriate form of chrome.manifest
mv $cmpdir/chrome-RELEASE.manifest $cmpdir/chrome.manifest
rm -f $cmpdir/chrome-DEBUG.manifest
# run the following 2 commands
cd $cmpdir/chrome/$jarname
jar cvf $jarname.jar *
cd -
# move $jarname.jar up one level
mv $cmpdir/chrome/$jarname/$jarname.jar $cmpdir/chrome/
# delete the '$jarname' folder
rm -rf $cmpdir/chrome/$jarname
# Zip chrome, chrome.manifest, install.rdf into hsadmin.xpi
cd $cmpdir
zip $jarname.xpi chrome/$jamname.jar chrome.manifest install.rdf
cd -

# change $jarname-update.rdf to indicate the new version number
# upload $jarname-update.rdf and to website $jarname.xpi to the web server
