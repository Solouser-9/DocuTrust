package com.docutrust.test;

import java.util.List;
import java.util.Map;

import com.docutrust.util.Json;

public class JsonTest {

    @DocuTest
    public void parseSerializeRoundTrip() {
        Map<String, Object> src = Json.obj(
                "str", "hello", "n", 42L, "d", 3.14, "b", true, "nil", null,
                "list", Json.arr(1, "two", Json.obj("k", false)),
                "nested", Json.obj("x", Json.obj("y", "z")));
        String written = Json.write(src);
        Map<String, Object> back = Json.parseObject(written);
        A.eq("hello", back.get("str"));
        A.eq(42L, back.get("n"));
        A.eq(3.14, back.get("d"));
        A.eq(true, back.get("b"));
        A.isTrue(back.containsKey("nil"));
        A.eq(null, back.get("nil"));
        @SuppressWarnings("unchecked")
        Map<String, Object> nested = (Map<String, Object>) back.get("nested");
        @SuppressWarnings("unchecked")
        Map<String, Object> x = (Map<String, Object>) nested.get("x");
        A.eq("z", x.get("y"));
        @SuppressWarnings("unchecked")
        List<Object> list = (List<Object>) back.get("list");
        A.eq(3, list.size());
        A.eq(1L, list.get(0));
        A.eq("two", list.get(1));
    }

    @DocuTest
    public void escapesSpecialCharacters() {
        String tricky = "quote\" backslash\\ newline\n tab\t unicode end";
        String written = Json.write(Json.obj("v", tricky));
        A.contains("\\\"", written);
        A.contains("\\\\", written);
        A.contains("\\n", written);
        A.contains("\\t", written);
        Map<String, Object> back = Json.parseObject(written);
        A.eq(tricky, back.get("v"));
    }

    @DocuTest
    public void controlCharsAreUnicodeEscaped() {
        String s = "a\u0001b";
        String written = Json.write(s);
        A.eq("\"a\\u0001b\"", written);
        A.eq(s, Json.parse(written));
    }

    @DocuTest
    public void parsesNumbers() {
        A.eq(42L, Json.parse("42"));
        A.eq(-7L, Json.parse("-7"));
        A.eq(0.5, Json.parse("0.5"));
        A.eq(1.0e3, Json.parse("1.0e3"));
        A.eq(true, Json.parse("true"));
        A.eq(null, Json.parse("null"));
        A.eq("x", Json.parse(" \"x\" "));
    }

    @DocuTest
    public void rejectsBrokenInput() {
        A.throwsA(IllegalArgumentException.class, () -> Json.parse("{"));
        A.throwsA(IllegalArgumentException.class, () -> Json.parse("[1,]"));
        A.throwsA(IllegalArgumentException.class, () -> Json.parse("{\"a\":1} trailing"));
        A.throwsA(IllegalArgumentException.class, () -> Json.parseObject("[1,2]"));
    }

    @DocuTest
    public void objBuildsOrderedMaps() {
        Map<String, Object> m = Json.obj("a", 1, "b", 2, "a", 3);
        A.eq(2, m.size());
        A.eq(3, m.get("a"));
        A.eq("[1,\"two\"]", Json.write(Json.arr(1, "two")));
    }
}
