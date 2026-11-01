package com.docutrust.test;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

import com.docutrust.util.Text;
import com.docutrust.vault.FileVault;

public class FileVaultTest {
    private static byte[] key(String seed) {
        byte[] k = new byte[32]; // AES-256
        for (int i = 0; i < k.length; i++) k[i] = (byte) (seed.charAt(i % seed.length()) + i);
        return k;
    }

    private static final byte[] KEY = key("unit-test-vault-key");
    private static final byte[] WRONG_KEY = key("another-key");

    private record Fixture(FileVault vault, Path dir, String storageKey, byte[] plaintext) {}

    private static Fixture fresh() throws Exception {
        Path dir = Files.createTempDirectory("docutrust-vault-test");
        FileVault vault = new FileVault(dir, KEY);
        byte[] data = new byte[5000];
        for (int i = 0; i < data.length; i++) data[i] = (byte) (i * 31 + 7);
        String key = FileVault.newStorageKey();
        vault.encrypt(new ByteArrayInputStream(data), key);
        return new Fixture(vault, dir, key, data);
    }

    @DocuTest
    public void roundTripIsLossless() throws Exception {
        Fixture f = fresh();
        FileVault.Decrypted dec = f.vault().decryptBytes(f.storageKey());
        A.isTrue(Arrays.equals(f.plaintext(), dec.data()));
        A.eq(Text.sha256Hex(f.plaintext()), dec.sha256());
        A.eq((long) f.plaintext().length, dec.size());
    }

    @DocuTest
    public void storageKeyShapeAndPaths() throws Exception {
        Fixture f = fresh();
        A.contains("/", f.storageKey());
        A.endsWith(".bin", f.storageKey());
        A.isTrue(Files.exists(f.vault().pathOf(f.storageKey())));
        A.throwsA(IllegalArgumentException.class, () -> f.vault().pathOf("../escape.bin"));
        A.throwsA(IllegalArgumentException.class, () -> f.vault().pathOf("/abs.bin"));
    }

    @DocuTest
    public void tamperedCiphertextIsRejected() throws Exception {
        Fixture f = fresh();
        Path file = f.vault().pathOf(f.storageKey());
        byte[] raw = Files.readAllBytes(file);
        raw[raw.length / 2] ^= 0x42; // flip bits in the middle (inside ciphertext, past the IV)
        Files.write(file, raw);
        A.throwsA(FileVault.TamperedException.class, () -> f.vault().decryptBytes(f.storageKey()));
    }

    @DocuTest
    public void wrongKeyIsRejected() throws Exception {
        Fixture f = fresh();
        FileVault impostor = new FileVault(f.dir(), WRONG_KEY);
        A.throwsA(FileVault.TamperedException.class, () -> impostor.decryptBytes(f.storageKey()));
    }

    @DocuTest
    public void deleteRemovesObject() throws Exception {
        Fixture f = fresh();
        A.isTrue(Files.exists(f.vault().pathOf(f.storageKey())));
        f.vault().delete(f.storageKey());
        A.isFalse(Files.exists(f.vault().pathOf(f.storageKey())));
    }
}
