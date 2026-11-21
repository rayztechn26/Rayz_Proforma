<?php

namespace App\Services;

use Illuminate\Validation\Rules\Password;

final class StrongPassword
{
    public static function rules(): array
    {
        return ['required', 'string', 'max:72', function ($attribute, $value, $fail) {
            if (strlen($value) > 72) {
                $fail('Password is too long.');
            }
        }, Password::min(12)->letters()->numbers()->mixedCase()];
    }
}
