<?php

namespace App\Services;

final class UserPassword
{
    public static function rules(): array
    {
        return ['bail', 'required', 'string', 'max:72', function ($attribute, $value, $fail) {
            if (! preg_match('/^[0-9]{6,72}$/D', $value)) {
                $fail('Use at least 6 digits for your password.');
            }
        }];
    }
}
