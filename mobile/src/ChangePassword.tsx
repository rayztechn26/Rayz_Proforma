import React,{useState} from "react";
import {Pressable,View} from "react-native";
import {Text} from "./typography";
import {AccountInput} from "./AccountInput";
import {useLocale} from "./locale";
import {api} from "./api";
import {ServiceNotice} from "./ServiceNotice";

export function ChangePassword(){
 const {t}=useLocale();const [open,setOpen]=useState(false),[current,setCurrent]=useState(""),[next,setNext]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
 const clear=()=>{setCurrent("");setNext("");setConfirm("");setError("");setOpen(false);};
 const button=(label:string,onPress:()=>void,primary=false)=><Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={{minHeight:44,justifyContent:"center",padding:10,backgroundColor:primary?"#117568":"transparent",borderRadius:8,opacity:busy ? 0.5 : 1}}><Text style={{color:primary?"white":"#245950",fontWeight:"600",textAlign:"center"}}>{t(label)}</Text></Pressable>;
 const submit=async()=>{
  setError("");setSuccess(false);
  if(!current){setError("Enter your current password.");return;}
  if(!/^[0-9]{6,72}$/.test(next)){setError("Use at least 6 digits for your password.");return;}
  if(next!==confirm){setError("The new passwords do not match.");return;}
  setBusy(true);
  try{await api("/password",{current_password:current,password:next,password_confirmation:confirm});clear();setSuccess(true);}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 return <View style={{marginVertical:8}}>
  {success&&<Text accessibilityRole="alert" style={{color:"#24684a",marginBottom:8}}>{t("Password changed. Other account sessions were signed out.")}</Text>}
  {!open?button("Change password",()=>{setOpen(true);setSuccess(false);}):<View style={{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#dce6e2"}}>
   <Text style={{fontSize:18,fontWeight:"600"}}>{t("Change password")}</Text>
   <Text style={{fontSize:12,color:"#607679",marginVertical:8}}>{t("Enter your current password, then choose a new password with at least 6 digits.")}</Text>
   <AccountInput label={t("Current password")} value={current} set={setCurrent} secret disabled={busy}/>
   <AccountInput label={t("New password")} value={next} set={setNext} secret numericPassword newPassword disabled={busy}/>
   <AccountInput label={t("Confirm new password")} value={confirm} set={setConfirm} secret numericPassword newPassword disabled={busy}/>
   {!!error&&<ServiceNotice message={error}/>}
   {button(busy?"Updating password…":"Update password",()=>{void submit();},true)}
   {button("Cancel",clear)}
  </View>}
 </View>;
}
