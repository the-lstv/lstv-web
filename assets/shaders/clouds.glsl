#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution, u_mouse;
uniform vec4 u_colors[2];
uniform float u_speed, u_time, u_scale, light, shadow, tint, coverage, alpha;
uniform float u_quality; // 0.0 to 1.0, controls iteration counts

const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1. + 2. * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2
    const float K2 = 0.211324865; // (3-sqrt(3))/6
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = step(a.yx, a.xy);
    vec2 b = a - o + K2;
    vec2 c = a - 1. + 2. * K2;
    vec3 h = max(.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.);
    vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.)));
    return dot(n, vec3(70.));
}

float fbm(vec2 n) {
    float total = 0., amplitude = .1;
    // Quality range: 4 to 7 iterations
    int iterations = int(mix(4.0, 7.0, u_quality));
    for (int i = 0; i < 7; i++) {
        if (i >= iterations) break;
        total += noise(n) * amplitude;
        n = m * n;
        amplitude *= .4;
    }
    return total;
}

void main() {
    vec2 p = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 uv = p * vec2(aspect, 1.);
    
    float speed = u_speed * .1;
    float time = u_time * speed;
    float scale = 1. - u_scale;
    
    float q = fbm(uv * scale * .5);
    vec2 baseUv = uv * scale - q;
    
    // First layer - quality range: 5 to 8 iterations
    int iterations1 = int(mix(5.0, 8.0, u_quality));
    float r = 0., weight = .8;
    vec2 uv1 = baseUv + time;
    for (int i = 0; i < 8; i++) {
        if (i >= iterations1) break;
        r += abs(weight * noise(uv1));
        uv1 = m * uv1 + time;
        weight *= .7;
    }
    
    // Second layer - quality range: 5 to 8 iterations
    int iterations2 = int(mix(5.0, 8.0, u_quality));
    float f = 0.;
    weight = .7;
    vec2 uv2 = baseUv + time;
    for (int i = 0; i < 8; i++) {
        if (i >= iterations2) break;
        f += weight * noise(uv2);
        uv2 = m * uv2 + time;
        weight *= .6;
    }
    f *= r + f;
    
    // Third layer - quality range: 4 to 7 iterations
    int iterations3 = int(mix(4.0, 7.0, u_quality));
    float c = 0.;
    weight = .4;
    vec2 uv3 = uv * vec2(aspect, 1.) * (scale * 2.) - q + time * 2.;
    for (int i = 0; i < 7; i++) {
        if (i >= iterations3) break;
        c += weight * noise(uv3);
        uv3 = m * uv3 + time * 2.;
        weight *= .6;
    }
    
    // Fourth layer - quality range: 4 to 7 iterations
    int iterations4 = int(mix(4.0, 7.0, u_quality));
    float c1 = 0.;
    weight = .4;
    vec2 uv4 = uv * vec2(aspect, 1.) * (scale * 3.) - q + time * 3.;
    for (int i = 0; i < 7; i++) {
        if (i >= iterations4) break;
        c1 += abs(weight * noise(uv4));
        uv4 = m * uv4 + time * 3.;
        weight *= .6;
    }
    
    c += c1;
    
    vec4 skycolour = mix(u_colors[1], u_colors[0], p.y);
    vec4 cloudcolour = vec4(1.) * clamp(1. - shadow + light * c, 0., 1.);
    f = coverage + 20. * alpha * f * r;
    cloudcolour = mix(skycolour, clamp(tint * skycolour + cloudcolour, 0., 1.), clamp(f + c, 0., 1.));
    
    gl_FragColor = cloudcolour;
}