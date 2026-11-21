const {withAndroidManifest}=require('@expo/config-plugins');
module.exports=config=>withAndroidManifest(config,c=>{c.modResults.manifest.application[0].$['android:allowBackup']='false';return c;});
