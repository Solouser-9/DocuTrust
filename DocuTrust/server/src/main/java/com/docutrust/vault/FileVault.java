package com.docutrust.vault;

import com.docutrust.util.Text;

import javax.crypto.Cipher;
import javax.crypto.CipherInputStream;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.UUID;

// AES-256-GCM file vault: 12-byte IV prefix + ciphertext with 128-bit tag; SHA-256 computed while streaming.
public final class FileVault {
    public static final class TamperedException extends GeneralSecurityException {
        public TamperedException(String m) { super(m); }
    }

    public record Stored(String sha256, long size) {}

    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private static final int CHUNK = 8192;
    private static final SecureRandom RNG = new SecureRandom();

    private final Path root;
    private final SecretKeySpec key;

    public FileVault(Path root, byte[] keyBytes) {
        this.root = root;
        this.key = new SecretKeySpec(keyBytes, "AES");
        try { Files.createDirectories(root); } catch (IOException e) { throw new IllegalStateException("Cannot create vault dir: " + root, e); }
    }

    public static String newStorageKey() {
        String uuid = UUID.randomUUID().toString();
        return uuid.substring(0, 2) + "/" + uuid + ".bin";
    }

    public Stored encrypt(InputStream in, String storageKey) throws IOException, GeneralSecurityException {
        Path target = pathOf(storageKey);
        Files.createDirectories(target.getParent());
        byte[] iv = new byte[IV_LEN];
        RNG.nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long size = 0;
        try (OutputStream out = Files.newOutputStream(target)) {
            out.write(iv);
            byte[] buf = new byte[CHUNK];
            int n;
            while ((n = in.read(buf)) > 0) {
                digest.update(buf, 0, n);
                size += n;
                byte[] ct = cipher.update(buf, 0, n);
                if (ct != null) out.write(ct);
            }
            out.write(cipher.doFinal());
        } catch (IOException | GeneralSecurityException e) {
            try { Files.deleteIfExists(target); } catch (IOException ignored) { }
            throw e;
        }
        return new Stored(Text.hex(digest.digest()), size);
    }

    public long decrypt(String storageKey, OutputStream out, MessageDigest digest) throws IOException, GeneralSecurityException {
        try (InputStream in = Files.newInputStream(pathOf(storageKey))) {
            byte[] iv = new byte[IV_LEN];
            int read = 0;
            while (read < IV_LEN) {
                int n = in.read(iv, read, IV_LEN - read);
                if (n < 0) throw new IOException("Vault object truncated");
                read += n;
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            long total = 0;
            try (CipherInputStream cis = new CipherInputStream(in, cipher)) {
                byte[] buf = new byte[CHUNK];
                int n;
                while ((n = cis.read(buf)) > 0) {
                    if (digest != null) digest.update(buf, 0, n);
                    out.write(buf, 0, n);
                    total += n;
                }
            } catch (IOException e) {
                if (isTamper(e)) throw new TamperedException("Vault tag verification failed - file tampered or wrong key");
                throw e;
            }
            return total;
        }
    }

    public Decrypted decryptBytes(String storageKey) throws IOException, GeneralSecurityException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        long size = decrypt(storageKey, buf, md);
        return new Decrypted(buf.toByteArray(), Text.hex(md.digest()), size);
    }

    public record Decrypted(byte[] data, String sha256, long size) {}

    public void delete(String storageKey) {
        try { Files.deleteIfExists(pathOf(storageKey)); } catch (IOException ignored) { }
    }

    public Path pathOf(String storageKey) {
        if (storageKey == null || storageKey.contains("..") || storageKey.startsWith("/"))
            throw new IllegalArgumentException("Unsafe storage key");
        return root.resolve(storageKey);
    }

    private static boolean isTamper(IOException e) {
        Throwable t = e;
        while (t != null) {
            if (t instanceof javax.crypto.AEADBadTagException) return true;
            String m = t.getMessage();
            if (m != null && m.toLowerCase().contains("tag mismatch")) return true;
            t = t.getCause();
        }
        return false;
    }
}
