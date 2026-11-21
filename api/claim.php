<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
$allowedOrigins = ['https://play-warcontry.com', 'https://www.play-warcontry.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['message' => 'Méthode non autorisée.']); exit;
}
if (!in_array($origin, $allowedOrigins, true)) {
    http_response_code(403); echo json_encode(['message' => 'Origine non autorisée.']); exit;
}
$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
$day = filter_var($data['day'] ?? null, FILTER_VALIDATE_INT);
$pseudo = trim((string)($data['pseudo'] ?? ''));
if (!$day || $day < 1 || $day > 24 || $pseudo === '' || mb_strlen($pseudo) > 32) {
    http_response_code(400); echo json_encode(['message' => 'Informations invalides.']); exit;
}
if (!preg_match('/^[\p{L}\p{N}_ .-]{1,32}$/u', $pseudo)) {
    http_response_code(400); echo json_encode(['message' => 'Le pseudo contient des caractères non autorisés.']); exit;
}
$now = new DateTimeImmutable('now', new DateTimeZone('Europe/Paris'));
if ($now->format('Y') !== '2026' || (int)$now->format('n') !== 12 || (int)$now->format('j') !== $day) {
    http_response_code(403); echo json_encode(['message' => 'Cette case ne peut être réclamée que le jour correspondant, en décembre 2026.']); exit;
}
$normalized = mb_strtolower($pseudo, 'UTF-8');
try {
    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO claims (claim_day, pseudo, pseudo_normalized, claimed_at) VALUES (:day, :pseudo, :normalized, NOW())');
    $stmt->execute([':day' => $day, ':pseudo' => $pseudo, ':normalized' => $normalized]);
    echo json_encode(['ok' => true, 'message' => 'Demande enregistrée.']);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        http_response_code(409); echo json_encode(['message' => 'Ce pseudo a déjà réclamé le cadeau de cette journée.']);
    } else {
        error_log('War Contry claim API error: ' . $e->getMessage());
        http_response_code(500); echo json_encode(['message' => 'Erreur serveur. Réessaie plus tard.']);
    }
}
