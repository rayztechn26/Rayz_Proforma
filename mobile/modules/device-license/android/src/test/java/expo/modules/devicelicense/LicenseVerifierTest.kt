package expo.modules.devicelicense
import org.junit.Test
import org.junit.Assert.*
import java.security.*
import java.security.interfaces.RSAPrivateKey
import java.util.Date
import com.nimbusds.jwt.*
import com.nimbusds.jose.*
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.util.Base64

class LicenseVerifierTest {
 private val server=KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
 private val device=KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
 private val keys=mapOf("test" to "-----BEGIN PUBLIC KEY-----\n"+Base64.encode(server.public.encoded).toString()+"\n-----END PUBLIC KEY-----")
 private fun token():String {
  val fp=MessageDigest.getInstance("SHA-256").digest(device.public.encoded).joinToString("") { "%02x".format(it.toInt() and 255) }
  val claims=JWTClaimsSet.Builder().subject("user").jwtID("license").issueTime(Date()).claim("company_id","company").claim("device_fp",fp).claim("kid","test").claim("format",1).claim("features",listOf("proforma","pdf","backup")).build()
  return SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test").build(),claims).apply { sign(RSASSASigner(server.private as RSAPrivateKey)) }.serialize()
 }
 private fun prove(n:ByteArray)=Signature.getInstance("SHA256withRSA").run { initSign(device.private);update(n);sign() }
 @Test fun validPermanentOfflineLicense(){assertTrue(LicenseVerifier.verify(token(),"company",keys,{device.public},::prove).contains("company"))}
 @Test fun signatureTampering(){val parts=token().split('.').toMutableList();parts[2]=(if(parts[2][0]=='a')"b" else "a")+parts[2].substring(1);assertThrows(Exception::class.java){LicenseVerifier.verify(parts.joinToString("."),"company",keys,{device.public},::prove)}}
 @Test fun differentCompany(){assertThrows(Exception::class.java){LicenseVerifier.verify(token(),"other",keys,{device.public},::prove)}}
 @Test fun otherDevice(){assertThrows(Exception::class.java){LicenseVerifier.verify(token(),"company",keys,{server.public},::prove)}}
 @Test fun missingDeviceKey(){assertThrows(Exception::class.java){LicenseVerifier.verify(token(),"company",keys,{error("key missing")},::prove)}}
 @Test fun missingPrivateKey(){assertThrows(Exception::class.java){LicenseVerifier.verify(token(),"company",keys,{device.public},{error("private key missing")})}}
 @Test fun wrongPossessionProof(){assertThrows(Exception::class.java){LicenseVerifier.verify(token(),"company",keys,{device.public},{ByteArray(256)})}}
 @Test fun untrustedSigningKey(){assertThrows(Exception::class.java){LicenseVerifier.verify(token(),"company",emptyMap(),{device.public},::prove)}}
}
