package expo.modules.devicelicense

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.*
import java.security.interfaces.RSAPublicKey
import java.security.spec.X509EncodedKeySpec
import java.util.UUID
import org.json.JSONObject
import com.nimbusds.jwt.SignedJWT
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.crypto.RSASSAVerifier

class DeviceLicenseModule : Module() {
 private val alias = "proforma.device.v1"
 private fun store(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
 private fun publicKey(): PublicKey = store().getCertificate(alias)?.publicKey ?: error("Device key missing. Request administrator-assisted transfer; records are preserved.")
 private fun signBytes(bytes: ByteArray): ByteArray {
  val privateKey = store().getKey(alias,null) as? PrivateKey ?: error("Device key missing")
  return Signature.getInstance("SHA256withRSA").run { initSign(privateKey);update(bytes);sign() }
 }
 override fun definition() = ModuleDefinition {
  Name("DeviceLicense")
  Function("randomId") { UUID.randomUUID().toString() }
  Function("ensureKey") {
   if(!store().containsAlias(alias)) {
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA,"AndroidKeyStore")
    generator.initialize(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY).setKeySize(2048).setDigests(KeyProperties.DIGEST_SHA256).setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1).setUserAuthenticationRequired(false).build())
    generator.generateKeyPair()
   }
   "-----BEGIN PUBLIC KEY-----\n"+Base64.encodeToString(publicKey().encoded,Base64.NO_WRAP)+"\n-----END PUBLIC KEY-----\n"
  }
  Function("sign") { message:String -> Base64.encodeToString(signBytes(message.toByteArray(Charsets.UTF_8)),Base64.NO_WRAP) }
  Function("verify") { token:String, companyId:String, keysJson:String ->
   val obj=JSONObject(keysJson)
   val keys=obj.keys().asSequence().associateWith { obj.getString(it) }
   LicenseVerifier.verify(token,companyId,keys,::publicKey,::signBytes)
  }
 }
}
