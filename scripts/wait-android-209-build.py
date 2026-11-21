from pathlib import Path
import subprocess,os,json,time,urllib.request,importlib.util
root=Path('D:/Projects/ProformaApp');mobile=root/'mobile'
node='C:/Users/Pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
eas='C:/Users/Pc/AppData/Local/npm-cache/_npx/e25a38a8cc65d08e/node_modules/eas-cli/bin/run'
python='C:/Users/Pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
env=dict(os.environ,EAS_NO_VCS='1');env['PATH']=str(Path(node).parent)+';'+env.get('PATH','')
build_id='4b0f5b12-70be-42b2-8b49-25edcb2c9e5e';last=None
while True:
 process=subprocess.run([node,eas,'build:view',build_id,'--json'],cwd=mobile,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=60)
 raw=process.stdout
 if process.returncode or '{' not in raw:
  print('Build status query unavailable; retrying.',flush=True);time.sleep(60);continue
 build,_=json.JSONDecoder().raw_decode(raw[raw.index('{'):]);(root/'tmp/rayz-209-build.json').write_text(json.dumps(build),encoding='utf-8')
 status=build.get('status')
 if status!=last:print('Expo build status: '+str(status),flush=True);last=status
 if status in ['ERRORED','CANCELED']:
  print(json.dumps({'buildId':build_id,'status':status,'error':build.get('error')}),flush=True);raise SystemExit(1)
 if status=='FINISHED':break
 time.sleep(60)
url=build.get('artifacts',{}).get('buildUrl') or build.get('artifacts',{}).get('applicationArchiveUrl')
assert url and url.startswith('https://')
file=root/'artifacts/Rayz-Proforma-2.0.9.apk';partial=file.with_suffix('.apk.part')
with urllib.request.urlopen(url,timeout=60) as response,partial.open('wb') as stream:
 while chunk:=response.read(1024*1024):stream.write(chunk)
partial.replace(file)
spec=importlib.util.spec_from_file_location('apk_verify',mobile/'scripts/verify-apk.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
report=module.verify(file,12)
assert report['versionName']=='2.0.9'
assert report['certificateSha256']==['8a23fe57b0e591dbc5fc608482e1e82fc1dad0f6ec93de8a8a2bcfe802e8a9ff']
labels=json.loads(subprocess.check_output([python,str(mobile/'scripts/verify-app-label.py'),str(file),'Rayz Proforma'],text=True))
report.update(labels);report.update({'buildId':build_id,'buildStatus':status,'sameSigningCertificateAs208':True,'mobileTestsPassed':89,'passwordBackendTestsPassed':7,'physicalAndroidDeviceTestPerformed':False})
(root/'artifacts/Rayz-Proforma-2.0.9-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2),flush=True)
