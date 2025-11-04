attribute vec2 a_position; varying vec2 vUV; void main() { vUV = (a_position + 1.0) / 2.0; gl_Position = vec4(a_position, 0.0, 1.0); }`, `
precision mediump float;
varying vec2 vUV;
uniform vec2 resolution;
uniform float time;
uniform vec4 areaBounds;   // vec4(centerX, centerY, radiusX, radiusY) in 0..1 UV space
uniform float areaFeather; // smooth edge width in UV units
uniform float areaInvert;  // 0.0 = inside oval, 1.0 = outside oval

vec2 hash22(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(vec2(p.x * p.y, p.x + p.y));
}

vec2 randomDir(vec2 r) {
    vec2 d = r - 0.5;
    float len = length(d);
    return len < 0.001 ? vec2(0.0, 1.0) : d / len;
}

float densityMap(vec2 uv, float t) {
    // Moving density waves
    float wave1 = sin(uv.x * 3.0 + t * 0.5) * 0.5 + 0.5;
    float wave2 = sin(uv.y * 4.0 - t * 0.3) * 0.5 + 0.5;

    // Circular density zones that move
    vec2 center1 = vec2(0.5 + sin(t * 0.4) * 0.3, 0.5 + cos(t * 0.3) * 0.3);
    vec2 center2 = vec2(0.5 - sin(t * 0.5) * 0.2, 0.5 - cos(t * 0.4) * 0.2);

    float dist1 = length(uv - center1);
    float dist2 = length(uv - center2);

    float zone1 = exp(-dist1 * 3.0);
    float zone2 = exp(-dist2 * 4.0);

    // Combine patterns
    float density = wave1 * wave2 * 0.3 + zone1 * 0.5 + zone2 * 0.4;

    return mix(0.4, 1.4, density);
}

float sparkleContribution(vec2 cellPos, vec2 fragPos, float tMove, float tEffect, float density) {
    vec2 rand = hash22(cellPos);

    // Use density to cull particles probabilistically
    if (rand.x > density) return 0.0;

    vec2 dir = randomDir(rand);
    float speed = mix(0.08, 0.24, rand.x);
    vec2 center = fract(rand + dir * tMove * speed);
    vec2 diff = (cellPos + center) - fragPos;
    float size = mix(0.001, 0.1, rand.y);
    float spark = exp(-pow(length(diff) / size, 10.5));
    float life = fract(tEffect * mix(0.5, 1.2, rand.x) + rand.y);
    float fade = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.75, 1.0, life));

    // Add bright glare during initial fade-in
    float glare = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.05, 0.15, life));
    float glareBrightness = glare * 2.5;

    float twinkle = 0.5 + 0.5 * sin(tEffect * 0.01 * mix(6.0, 14.0, rand.x) + rand.y * 6.283);
    return spark * twinkle * fade * (1.0 + glareBrightness);
}

float ovalMask(vec2 uv) {
    // Dynamic shape modulation
    float breathe = sin(time * 0.8) * 0.15;
    float pulse = sin(time * 1.2) * 0.1;

    vec2 center = areaBounds.xy;
    vec2 radius = areaBounds.zw;

    // Modulate radii for breathing effect
    radius.x += breathe;
    radius.y += pulse;

    // Add subtle warping
    float angle = atan(uv.y - center.y, uv.x - center.x);
    float warp = sin(angle * 3.0 + time * 0.5) * 0.05;

    vec2 diff = (uv - center) / (radius + warp);
    float dist = length(diff);

    float feather = max(areaFeather, 1e-4);
    float mask = 1.0 - smoothstep(1.0 - feather, 1.0 + feather, dist);

    return mix(mask, 1.0 - mask, clamp(areaInvert, 0.0, 1.0));
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 fragPos = uv * vec2(50.0, 28.0);
    vec2 baseCell = floor(fragPos);
    float tMove = time * 2.0;
    float tEffect = time * 0.6;

    // Calculate density for this UV position
    float density = densityMap(uv, time);

    float glow = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 cell = baseCell + vec2(float(x), float(y));
            glow += sparkleContribution(cell, fragPos, tMove, tEffect, density);
        }
    }

    float areaMask = ovalMask(uv);
    glow = clamp(glow * areaMask, 0.0, 1.0);
    vec3 color = vec3(1.0) * glow;
    float alpha = glow * 0.85;
    
    gl_FragColor = vec4(color, alpha);
}
