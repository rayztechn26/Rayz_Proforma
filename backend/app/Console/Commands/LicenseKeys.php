<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class LicenseKeys extends Command
{
    protected $signature = 'license:keys {directory : Absolute directory outside source and web root} {kid : Unique key identifier}';

    protected $description = 'Generate RSA-3072 signing key and public verification key map';

    public function handle(): int
    {
        $dir = $this->argument('directory');
        $kid = $this->argument('kid');
        if (! preg_match('/^[A-Za-z0-9_-]{1,80}$/D', $kid)) {
            return 1;
        }if (! is_dir($dir)) {
            mkdir($dir, 0700, true);
        }$real = realpath($dir);
        $source = strtolower(realpath(is_file(base_path('../mobile/package.json')) ? base_path('..') : base_path()));
        if (strtolower($real) === $source || str_starts_with(strtolower($real), $source.DIRECTORY_SEPARATOR)) {
            $this->error('Choose a directory outside project source.');

            return 1;
        }$private = $real.DIRECTORY_SEPARATOR.$kid.'.pem';
        $public = $real.DIRECTORY_SEPARATOR.'public-keys.json';
        if (file_exists($private)) {
            $this->error('Key already exists. Never overwrite signing keys.');

            return 1;
        }$key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 3072]);
        if (! $key) {
            throw new \RuntimeException('RSA generation failed');
        }openssl_pkey_export($key, $pem);
        file_put_contents($private, $pem, LOCK_EX);
        chmod($private, 0600);
        $keys = is_file($public) ? json_decode(file_get_contents($public), true) : [];
        $keys[$kid] = openssl_pkey_get_details($key)['key'];
        file_put_contents($public, json_encode($keys, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $this->info('Key files generated. Restrict private file ACL to the service account.');
        $this->line('LICENSE_KEY_ID='.$kid);
        $this->line('LICENSE_PRIVATE_KEY_PATH='.$private);
        $this->line('LICENSE_PUBLIC_KEYS_PATH='.$public);
        $this->line('Embed only public-keys.json in mobile/src/license-keys.json before building.');

        return 0;
    }
}
