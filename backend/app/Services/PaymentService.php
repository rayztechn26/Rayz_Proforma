<?php

namespace App\Services;

interface PaymentService
{
    public function approve(string $id, string $reference, int $received, string $notes): object;
}
