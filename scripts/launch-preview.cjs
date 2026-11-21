// Isolated marketing screenshots of real UI components. No production API,
// device keys, licence grants, customer records or account mutations are used.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/launch-preview');
const esbuild=require(path.join(root,'mobile/node_modules/esbuild'));
const {chromium}=require('C:/Users/Pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
fs.mkdirSync(dir,{recursive:true});
const fixture=path.join(dir,'fixture.ts');
fs.writeFileSync(fixture,`import {newCompany,newCustomer,newDocument} from '${root.replace(/\\/g,'/')}/mobile/src/domain';
export const company={...newCompany(),id:'sample-company',name:'Example Trading · SAMPLE',tin:'SAMPLE ONLY',address:'Addis Ababa',phone:'',logo:'/icon.png',stamp:'/stamp.png',termsAndConditions:''};
export const customer={...newCustomer(company.id),id:'sample-customer',name:'Example Customer · SAMPLE',address:'Addis Ababa'};
export const document={...newDocument(company,customer),id:'sample-document',number:'DEMO-2026-0001',issueDate:'2026-10-26',validUntil:'2026-11-10',status:'issued',lines:[{id:'a',description:'Office chair / የቢሮ ወንበር',unit:'pcs',quantity:'4',price:'2500'},{id:'b',description:'Delivery / ማጓጓዣ',unit:'trip',quantity:'1',price:'500'}]};
export const item={id:'sample-item',companyId:company.id,name:'Office chair',description:'Office chair',unit:'pcs',price:'2500'};`);
const f=fixture.replace(/\\/g,'/');
const mocks={
 'expo-router':`import React from 'react';export const router={push:()=>{},replace:()=>{},dismissAll:()=>{}};export const useLocalSearchParams=()=>Object.fromEntries(new URLSearchParams(location.search));export const useFocusEffect=f=>React.useEffect(f,[]);export const useNavigation=()=>({addListener:()=>()=>{},dispatch:()=>{}});`,
 '@react-navigation/native':`export const usePreventRemove=()=>{};`,
 'expo-secure-store':`export const getItemAsync=async()=>new URLSearchParams(location.search).get('signed')==='0'?null:'demo-token-not-valid';export const setItemAsync=async()=>{};export const deleteItemAsync=async()=>{};`,
 'expo-image-picker':`export const launchImageLibraryAsync=async()=>({canceled:true});`,
 'react-native-safe-area-context':`export {View as SafeAreaView,View as SafeAreaProvider} from 'react-native';`,
 native:`import {company,customer,document,item} from '${f}';const repo={companies:()=>[company],company:()=>company,setting:k=>k==='activeCompany'?company.id:'',setSetting:()=>{},suggested:()=>'DEMO-2026-0002',saveCompany:()=>{},customers:()=>[customer],customer:()=>customer,catalogue:()=>[item],documents:()=>[document],document:()=>({...document,status:new URLSearchParams(location.search).get('page')==='edit'?'draft':'issued'})};export const getRepo=()=>repo;export const logoData=async()=>'';export const chooseLogo=async()=>null;export const chooseStamp=async()=>null;export const stampData=async()=>'';export const pdfAction=async()=>{};export const exportBackup=async()=>{};export const pickBackup=async()=>null;export const restoreBackup=async()=>{};`,
 licensing:`export const assertLicense=()=>{};export const loadLicense=async()=>{if(new URLSearchParams(location.search).get('signed')==='0')throw Error('Unactivated demo');};export const nativeKeys=async()=>({});export const proof=async()=>({});export const recoverCompany=async()=>{};export const registerCompany=async()=>{};`,
 api:`export const configured=()=>true;export const api=async()=>{if(new URLSearchParams(location.search).get('signed')==='0'){const e=Error('');throw e;}return {phone:'+251900000000',settings:{enabled:true,fee:'1000.00',merchant:'Thomas Abate',recipient:'0911099246',instructions:'Confirm the recipient before paying. / ከመክፈልዎ በፊት የተቀባዩን ስም ያረጋግጡ።',waiting:'Contact support / ድጋፍ ያግኙ',support:'0911099246 / 0947833314'},payments:[],entitlements:[],companies:[],changes:[]};};export const authenticate=async()=>{};export const logout=async()=>{};`
};
(async()=>{
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import App from '${root.replace(/\\/g,'/')}/mobile/app/index.tsx';import{LanguageProvider}from'${root.replace(/\\/g,'/')}/mobile/src/locale';createRoot(document.getElementById('root')).render(<LanguageProvider initialLanguage={new URLSearchParams(location.search).get('lang')==='am'?'am':'en'}><App/></LanguageProvider>);`;
 await esbuild.build({stdin:{contents:entry,resolveDir:path.join(root,'mobile'),loader:'tsx'},outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',define:{__DEV__:'false','process.env.NODE_ENV':'"production"'},loader:{'.png':'dataurl'},plugins:[{name:'isolated-fixtures',setup(b){b.onResolve({filter:/.*/},a=>{if(a.path==='react-native')return{path:require.resolve('../mobile/node_modules/react-native-web')};const k=a.path in mocks?a.path:(/\/(native|licensing|api)$/.exec(a.path)||[])[1];if(k&&mocks[k])return{path:k,namespace:'fixture'};});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:path.join(root,'mobile')}));}}]});
 for(const file of fs.readdirSync(path.join(root,'mobile/assets/fonts')))fs.copyFileSync(path.join(root,'mobile/assets/fonts',file),path.join(dir,file));
 fs.copyFileSync(path.join(root,'mobile/assets/icon.png'),path.join(dir,'icon.png'));fs.copyFileSync(path.join(root,'mobile/tests/fixtures/sample-stamp.png'),path.join(dir,'stamp.png'));
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:AppSans;src:url(Inter_400Regular.ttf)}@font-face{font-family:AppSans;src:url(Inter_600SemiBold.ttf);font-weight:600 900}@font-face{font-family:AppEthiopic;src:url(NotoSansEthiopic_400Regular.ttf)}@font-face{font-family:AppEthiopic;src:url(NotoSansEthiopic_600SemiBold.ttf);font-weight:600 900}body{margin:0;background:#f0f5f4}#root{height:900px}*{box-sizing:border-box}</style><div id="root"></div><script src="app.js"></script>`);
 const out=path.join(root,'output/launch-pack/website/assets/screenshots');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const lang of ['en','am'])for(const screen of ['register','payment','home','company','customers','edit','preview','settings','password']){
  const page=await browser.newPage({viewport:{width:430,height:900},deviceScaleFactor:1.5});
  page.on('pageerror',e=>console.error('Preview '+screen+': '+e.message));
  await page.route('http://launch-preview.test/**',route=>{const p=new URL(route.request().url()).pathname,file=path.join(dir,p==='/'?'index.html':p);return fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
  const route=screen==='register'||screen==='payment'||screen==='password'?'activation':screen;
  const id=screen==='company'?'sample-company':screen==='preview'||screen==='edit'?'sample-document':'';
  await page.goto(`http://launch-preview.test/?page=${route}&id=${id}&lang=${lang}&signed=${screen==='register'?'0':'1'}`);
  if(screen==='register'){const am=JSON.parse(fs.readFileSync(path.join(root,'mobile/src/activation-am.json')));await page.getByRole('button',{name:lang==='en'?'New account? Register':am['New account? Register'],exact:true}).click();}
  if(screen==='password'){const am=JSON.parse(fs.readFileSync(path.join(root,'mobile/src/activation-am.json')));await page.getByRole('button',{name:lang==='en'?'Change password':am['Change password'],exact:true}).click();}
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
  await page.screenshot({path:path.join(out,`${screen}-${lang}.png`)});
  if(await page.locator('body').innerText().then(x=>x.trim().length)<80)throw Error('Empty preview '+screen);
  const translations={...JSON.parse(fs.readFileSync(path.join(root,'mobile/src/am.json'))),...JSON.parse(fs.readFileSync(path.join(root,'mobile/src/activation-am.json')))};
  const extra=screen==='edit'?['edit-items','Line items']:screen==='preview'?['preview-actions','PDF preview']:screen==='payment'?['payment-submit','Submit payment for a company']:null;
  if(extra){const label=lang==='en'?extra[1]:translations[extra[1]];const anchor=screen==='preview'?page.getByRole('button',{name:label,exact:true}):page.getByText(label,{exact:true});await anchor.first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,`${extra[0]}-${lang}.png`)});}
  await page.close();
 }
 await browser.close();console.log('24 real-component screenshots captured with isolated fictional fixtures.');
})().catch(e=>{console.error(e);process.exit(1)});

