var businessCardShaderVS = `#version 300 es

precision highp float;

layout (location=0) in vec3 vertexPos;
layout (location=1) in vec2 a_texcoord;
layout (location=2) in vec3 vertexNormal;
// layout (location=2) in vec4 vertexColor;

out vec2 v_texcoord;
out vec3 v_intersectionPos;
out vec3 v_pos;
out vec3 v_normal;
//out vec3 v_mousePositions[20];

//
uniform vec3 viewPos;
uniform vec3 rayDir;
uniform float intersectionParam;
uniform float tValues[20];
//
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    gl_Position = projection * view * model * vec4(vertexPos, 1.0);
    vec3 tmpPos = viewPos + intersectionParam * rayDir;
    v_intersectionPos = vec3( tmpPos ) ;
    v_texcoord = a_texcoord;
    v_pos = vec3(vertexPos ); // CHANGE ME

    // for(int i = 0; i < 20; i++)
    // {
    //     v_mousePositions[i] = viewPos + tValues[i] * rayDir;
    // }
    //v_tValues = tValues;

    v_normal = vertexNormal;
}
`

var businessCardShaderFS = `#version 300 es

precision highp float;

in vec2 v_texcoord;
in vec3 v_intersectionPos;
in vec3 v_pos;
in vec3 v_normal;
//in vec3 v_mousePositions[20];
//
out vec4 fragColor;
//
uniform vec3 viewPos;
uniform vec2 resolution;
uniform float time;
uniform sampler2D u_texture;

// constants macros
#define PI (3.14159)

// function macros
#define ss smoothstep

// ------------------ Structs ------------------
struct Rect
{
    vec2 pos;
    float w;
    float h;
} aRect;

// ------------------ 2D Shapes ------------------
float square(vec2 p, float w, float h, vec2 domain)
{
    float sq = ss(p.x - w, p.x - w + 0.01, domain.x)
             * (1. - ss(p.x + w, p.x + w + 0.01, domain.x))
             * ss(p.y - h, p.y - h + 0.01, domain.y)
             * (1. - ss(p.y + h, p.y + h + 0.01, domain.y));
    return sq;
}

// ------------------ Util Functions ------------------
// takes in a vec2 and 
// gives a rotation about their cross product axis
vec2 rotateOnOrigin(vec2 v, float theta)
{
    mat2 rot = mat2( cos(theta), sin(theta),
                    -sin(theta), cos(theta)
                   );
    return rot * v;
}

vec2 rotateAtPos(vec2 p, vec2 v, float theta)
{
    // Translate origin’ to the origin along with all other points
    v -= p;
    // rotate
    mat2 rot = mat2( cos(theta), sin(theta),
                    -sin(theta), cos(theta)
                   );
    v = rot * v;
    // translate back
    v += p;
    return v;
}

float squiglySquare(vec2 p, float w, float h, vec2 domain, float t, float sh)
{
    float rr = 100.0; 
    float squiglyXLeft   = sh * cos(domain.y * rr + 10. * t);
    float squiglyXRight  = sh * cos(domain.y * rr - 10. * t);
    float squiglyYBottom = 0.; //sh * cos(domain.x * 4. - 10. * t);
    float squiglyYTop    = 0.; //sh * cos(domain.x * 4. + 10. * t);
    return ss(p.x - w - squiglyXRight , p.x - w - squiglyXRight + 0.01, domain.x)
               * (1. - ss(p.x + w + squiglyXLeft, p.x + w + squiglyXLeft+ 0.01, domain.x))
               * ss(p.y - h, p.y - h+ 0.01, domain.y)
               * (1. - ss(p.y + h, p.y + h + 0.01, domain.y));
}

float when_gt(float x, float y)
{
    return max(sign(x - y), 0.0);
}
float when_lt(float x, float y)
{
    return max(sign(y - x), 0.0);
}
float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

#define BLOG_COLOR   (vec3(0., 0.6, 0.))
#define MUSIC_COLOR  (vec3(-1., 0.2, 1.))
#define PEDALS_COLOR (vec3(0, 0, 0.8))
void main()
{
    // -------------------------------------------------------------------------
    vec2 uv = vec2(v_pos.x, v_pos.y);
    vec2 mouse = vec2(v_intersectionPos.x, v_intersectionPos.y);

    //
    vec3 normal = normalize(v_normal); // normalize vector as it's been interpolated accross shaders
    // get dot product to check which side we're on, negative values --> front, positve values --> back
    // consolitdate this...
    float dotWithBack =  dot(normal, vec3(0., 0., -1.));
    float dotWithFront = dot(normal, vec3(0., 0., 1.));

    vec2 uvPrime = uv - mouse;
    uvPrime = rotateAtPos(vec2(0.), uvPrime, dotWithFront * time);
    float angle = atan(uvPrime.y / uvPrime.x);

    // 2.5, 3.0, 3.5;
    aRect.pos = mouse;
    aRect.h = 0.175;
    aRect.w = (0.175 * 3.5);
    
    float sq = squiglySquare(aRect.pos, aRect.w, aRect.h, uv, time, 0.025);
    float theMask = 1. - sq;
    vec4 texSample = texture(u_texture, vec2(v_texcoord.x, -v_texcoord.y));

    //
    float r = 0.2 + 0.025 * cos(10. * angle);
    float theFrontMask = smoothstep(r, r + 0.01, length(uvPrime));

    //------------------------------------------------------------------------

    float backSwitch = when_gt(dotWithBack, 0.0); // zero for front normals
    float frontSwitch = when_gt(dotWithFront, 0.0); // zero for front normals
    //
    // col if dot with forward is +tive
    vec3 col = texSample.xyz * theMask + (1. - theMask) * 2. * texSample.xyz * (vec3(1.) - texSample.xyz);
    float blogSwitch  =  when_lt(mouse.y, -0.3) * when_gt(mouse.y, -0.5);
    float musicSwitch =  when_lt(mouse.y,  0.1) * when_gt(mouse.y, -0.1);
    float pedalsSwitch = when_lt(mouse.y,  0.5) * when_gt(mouse.y,  0.25);
    float columnSwitch = when_lt(abs(mouse.x), 0.55) * when_lt(abs(mouse.y), 0.5);
    col += columnSwitch * ( BLOG_COLOR   * blogSwitch   * (1. - musicSwitch ) * (1. - pedalsSwitch ) 
                                        + MUSIC_COLOR  * musicSwitch  * (1. - blogSwitch )  * (1. - pedalsSwitch ) 
                                        + PEDALS_COLOR * pedalsSwitch * (1. - blogSwitch )  * (1. - musicSwitch ) );

    // col if dot with forward is -tive
    vec3 frontCol = texSample.xyz * theFrontMask + (1. - theFrontMask) * 2. * texSample.xyz * (vec3(1.) - texSample.xyz);
    
    // final color is both colors in superposition:
    vec3 theCol = frontSwitch * frontCol + backSwitch * columnSwitch * col + backSwitch * (1. -  columnSwitch) * frontCol;
    // Gamma correction:

    // Blinn-Phong
    // vec3 lightDir = normalize(v_pos - vec3(5, 5, -5));
    // float diff = max(dot(lightDir, normal), 0.0);
    // vec3 diffuse = diff * theCol;
    // // specular
    // vec3 viewDir = normalize(viewPos - v_pos);
    // vec3 reflectDir = reflect(-lightDir, normal);
    // vec3 halfwayDir = normalize(lightDir + viewDir);  
    // float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);
    // vec3 specular = vec3(0.3) * spec;
    // //float gamma = 2.2;
    // //col = pow(col, vec3(1.0 / gamma));
    // theCol += specular;
    fragColor = vec4(theCol,1.0);
}`