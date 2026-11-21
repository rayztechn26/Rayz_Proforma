<?php

namespace Tests\Feature;

use Illuminate\Encryption\Encrypter;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class ProductionAdminExportTest extends TestCase
{
    private string $folder;

    private string $key;

    protected function setUp(): void
    {
        parent::setUp();
        $this->folder = sys_get_temp_dir().DIRECTORY_SEPARATOR.'proforma-export-'.bin2hex(random_bytes(8));
        mkdir($this->folder, 0700);
        $this->key = random_bytes(32);
        file_put_contents($this->folder.'/.env', "APP_ENV=production\nADMIN_LOCAL_TEST_WITHOUT_TOTP=false\nAPP_KEY=base64:".base64_encode($this->key)."\n");
    }

    protected function tearDown(): void
    {
        foreach (['.env', 'admin.sql'] as $f) {
            if (is_file($this->folder.'/'.$f)) {
                unlink($this->folder.'/'.$f);
            }
        }rmdir($this->folder);
        parent::tearDown();
    }

    public function test_export_contains_only_hash_and_secret_encrypted_for_production_key(): void
    {
        $secret = 'JBSWY3DPEHPK3PXP';
        $g = \Mockery::mock(Google2FA::class);
        $g->shouldReceive('generateSecretKey')->once()->andReturn($secret);
        $g->shouldReceive('verifyKey')->with($secret, '123456', 1)->once()->andReturn(true);
        $this->app->instance(Google2FA::class, $g);
        $this->artisan('admin:export-production', ['environment' => $this->folder.'/.env', 'output' => $this->folder.'/admin.sql', '--phone' => '+251947833314'])->expectsQuestion('New production password (12+ characters, mixed-case letters and numbers)', 'ProductionExample123')->expectsQuestion('Confirm new production password', 'ProductionExample123')->expectsQuestion('Current 6-digit authenticator code', '123456')->assertSuccessful();
        $sql = file_get_contents($this->folder.'/admin.sql');
        $this->assertStringNotContainsString('ProductionExample123', $sql);
        $this->assertStringNotContainsString($secret, $sql);
        $this->assertStringContainsString('admin.provisioned', $sql);
        preg_match("/VALUES \\('Production administrator','[^']+','([^']+)','\\+251947833314','([^']+)'/", $sql, $m);
        $this->assertTrue(password_verify('ProductionExample123', $m[1]));
        $this->assertSame($secret, (new Encrypter($this->key, 'AES-256-CBC'))->decryptString($m[2]));
    }

    public function test_non_production_environment_cannot_export_admin(): void
    {
        file_put_contents($this->folder.'/.env', "APP_ENV=local\n");
        $this->artisan('admin:export-production', ['environment' => $this->folder.'/.env', 'output' => $this->folder.'/admin.sql'])->assertFailed();
        $this->assertFileDoesNotExist($this->folder.'/admin.sql');
    }

    public function test_export_never_overwrites_existing_sql(): void
    {
        file_put_contents($this->folder.'/admin.sql', 'preserve');
        $this->artisan('admin:export-production', ['environment' => $this->folder.'/.env', 'output' => $this->folder.'/admin.sql'])->assertFailed();
        $this->assertSame('preserve',file_get_contents($this->folder.'/admin.sql'));
    }
}
