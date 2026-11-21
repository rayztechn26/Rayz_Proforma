package expo.modules.devicelicense

import java.security.*
import java.security.interfaces.RSAPublicKey
import java.security.spec.X509EncodedKeySpec
import com.nimbusds.jwt.SignedJWT
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.crypto.RSASSAVerifier
import com.nimbusds.jose.util.Base64

// Pure JVM verifier used by Android; unit tests exercise this exact code.
object LicenseVerifier {
 fun verify(token:String, companyId:String, keys:Map<String,String>, deviceKey:()->PublicKey, prove:(ByteArray)->ByteArray):String {
  val jwt=SignedJWT.parse(token)
  require(jwt.header.algorithm==JWSAlgorithm.RS256 && jwt.header.criticalParams.isNullOrEmpty()) { "Unsupported licence signature" }
  val kid=jwt.header.keyID ?: error("Missing signing key identifier")
  val pem=keys[kid] ?: error("Unknown licence signing key. Update the app or contact support.")
  val encoded=pem.replace(Regex("-----[^-]+-----|\\s"),"")
  val key=KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(Base64(encoded).decode())) as RSAPublicKey
  require(jwt.verify(RSASSAVerifier(key))) { "Invalid licence signature" }
  val claims=jwt.jwtClaimsSet
  val pub=deviceKey()
  val fingerprint=MessageDigest.getInstance("SHA-256").digest(pub.encoded).joinToString("") { "%02x".format(it.toInt() and 255) }
  require(claims.getStringClaim("company_id")==companyId && claims.getStringClaim("device_fp")==fingerprint) { "Licence belongs to a different company or device" }
  require(claims.getLongClaim("format")==1L && claims.getStringClaim("kid")==kid && !claims.jwtid.isNullOrEmpty() && !claims.subject.isNullOrEmpty() && claims.issueTime!=null && claims.getStringListClaim("features").containsAll(listOf("proforma","pdf","backup"))) { "Invalid licence claims" }
  val nonce=ByteArray(32).also { SecureRandom().nextBytes(it) }
  val signature=prove(nonce)
  require(Signature.getInstance("SHA256withRSA").run { initVerify(pub);update(nonce);verify(signature) }) { "Device key possession failed" }
  return claims.toString()
 }
}
