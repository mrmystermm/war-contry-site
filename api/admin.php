<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
session_name('warcontry_admin');
session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Strict']);
session_start();

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: admin.php');
    exit;
}
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if (password_verify((string)$_POST['password'], ADMIN_PASSWORD_HASH)) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        header('Location: admin.php');
        exit;
    }
    $error = 'Mot de passe incorrect.';
}
function h(string $v): string { return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
?><!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Administration — War Contry</title>
<style>
body{margin:0;background:#08111f;color:#eef3fb;font:16px system-ui;padding:28px}main{max-width:900px;margin:auto}section{background:#121f31;border:1px solid #293a50;border-radius:14px;padding:22px;margin:18px 0}input,button{font:inherit;padding:11px;border-radius:8px;border:1px solid #60738b}button{background:#c99b42;color:#101827;font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #34445a}a{color:#f2c66d}.err{color:#ff9999}
</style><main><h1>🎁 Réclamations privées — War Contry</h1>
<?php if (empty($_SESSION['admin'])): ?>
<section><h2>Connexion organisateur</h2><?php if($error): ?><p class="err"><?=h($error)?></p><?php endif; ?><form method="post"><label>Mot de passe administrateur<br><input type="password" name="password" required autocomplete="current-password"></label> <button>Se connecter</button></form></section>
<?php else: ?>
<p>Cette page est privée. Les joueurs ne peuvent pas consulter cette liste.</p><p><a href="?logout=1">Se déconnecter</a></p>
<section><h2>Demandes reçues</h2>
<?php try { $rows = db()->query('SELECT claim_day,pseudo,claimed_at FROM claims ORDER BY claim_day DESC, claimed_at DESC')->fetchAll(); ?>
<?php if (!$rows): ?><p>Aucune demande pour le moment.</p><?php else: ?><table><thead><tr><th>Jour</th><th>Pseudo Minecraft</th><th>Date de réception</th></tr></thead><tbody>
<?php foreach($rows as $r): ?><tr><td><?=h((string)$r['claim_day'])?> décembre</td><td><?=h($r['pseudo'])?></td><td><?=h($r['claimed_at'])?></td></tr><?php endforeach; ?>
</tbody></table><?php endif; ?>
<?php } catch(Throwable $e) { echo '<p class="err">Impossible de lire la base de données. Vérifie la configuration.</p>'; error_log($e->getMessage()); } ?>
</section><?php endif; ?></main></html>
