<?php

use App\Http\Middleware\AdminLocale;
use App\Http\Middleware\AdminOnly;
use App\Http\Middleware\ApiRequestContext;
use App\Http\Middleware\ApiToken;
use App\Http\Middleware\HttpsOnly;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [AdminLocale::class]);
        $middleware->prepend(ApiRequestContext::class);
        $middleware->append(HttpsOnly::class);
        $middleware->alias(['token' => ApiToken::class, 'admin' => AdminOnly::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $e) => $request->is('api/*') || $request->expectsJson());
        $exceptions->respond(function (Response $response) {
            if ($id = request()->attributes->get('api_request_id')) {
                $response->headers->set('X-Request-ID', $id);
            }

            return $response;
        });
    })->create();
