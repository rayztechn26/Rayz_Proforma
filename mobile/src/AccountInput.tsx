import React, {useState} from "react";
import {Pressable, View} from "react-native";
import {Text, TextInput} from "./typography";
import {useLocale} from "./locale";

export function AccountInput({label,value,set,secret=false,phoneInput=false,numericPassword=false,newPassword=false,disabled=false}: {
 label:string;value:string;set:(value:string)=>void;secret?:boolean;phoneInput?:boolean;numericPassword?:boolean;newPassword?:boolean;disabled?:boolean;
}) {
 const {t}=useLocale();const [visible,setVisible]=useState(false);
 return <View style={{marginVertical:6}}>
  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
   <Text style={{fontSize:12,fontWeight:"600",color:"#314e54",flex:1}}>{label}</Text>
   {secret&&<Pressable accessibilityRole="button" accessibilityLabel={`${t(visible?"Hide password":"Show password")}: ${label}`} onPress={()=>setVisible(!visible)} style={{minWidth:52,minHeight:44,alignItems:"flex-end",justifyContent:"center"}}><Text style={{fontSize:12,color:"#117568"}}>{t(visible?"Hide":"Show")}</Text></Pressable>}
  </View>
  <TextInput accessibilityLabel={label} value={value} onChangeText={set} editable={!disabled} secureTextEntry={secret&&!visible} keyboardType={phoneInput?"phone-pad":numericPassword?"number-pad":"default"} maxLength={numericPassword?72:undefined} autoComplete={secret?(newPassword?"new-password":"current-password"):phoneInput?"tel":"off"} autoCorrect={false} spellCheck={false} autoCapitalize="none" style={{backgroundColor:"white",borderColor:"#a8c2bd",borderWidth:1,minHeight:44,paddingVertical:10,paddingHorizontal:12,fontSize:14,borderRadius:9,marginTop:5}}/>
 </View>;
}
