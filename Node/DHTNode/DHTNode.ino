#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <ESP8266HTTPClient.h>

#include "dht.h"
#include "constants.h"

#define DHT11_PIN D3
#define BLUE_PIN D6
#define GREEN_PIN D5
#define RED_PIN D4

#define COLOUR_COUNT 10
#define INT_MAX 214748364

String colours[COLOUR_COUNT] = { "e6194b", "3cb44b", "ffe119", "0082c8", "f58231", "911eb4", "46f0f0", "d2f53c", "fabebe", "e6beff" };
String colour = "";
long count;
double averageTemp;
double averageHumidity;
String macAddr;
boolean registered = false;
int blinkCount = 0;
int blinkOn = false;

ESP8266WebServer server(80);
dht DHT;
HTTPClient http;

void setup() {
  Serial.begin(115200);
  Serial.println("");
  Serial.println("Hello ESP8266");
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  for (int i = 0; i < 20; i++) {
      digitalWrite(LED_BUILTIN, i % 2 == 0);
      delay(100);
  }
  String ipAddress = setupServer();
  Serial.println("Registering device on SensorNetwork");
  unsigned char mac[6];
  WiFi.macAddress(mac);  
  macAddr = macToStr(mac);
  boolean high = true;
  while(!registered) { 
    digitalWrite(LED_BUILTIN, high);
    high = !high;
    registerDevice(macAddr, ipAddress);
    delay(1000);
  }
  
  setColour(colour);
  count = 0;
  averageTemp = 0;
  averageHumidity = 0;
  for (int i = 0; i < 20; i++) {
      digitalWrite(LED_BUILTIN, i % 2 == 0);
      delay(100);
  }
  digitalWrite(LED_BUILTIN, LOW);
}

String setupServer() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.println("");

  // Wait for connection
  boolean high = true;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    digitalWrite(LED_BUILTIN, high);
    high = !high;
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(WIFI_SSID);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if (MDNS.begin("esp8266")) {
    Serial.println("MDNS responder started");
  }

  server.on("/", handleRoot);
  server.on("/reset", handleReset);
  server.on("/average", handleAverage);
  server.on("/temperature", handleTemperature);
  server.on("/blink", handleBlink);

  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("HTTP server started");

  return WiFi.localIP().toString();
}

String getInterpolatedColour(float difference) {
  if (difference < 0) {
    difference = 0;
  }
  if (difference > 100) {
    difference = 100;
  }
  //BLUE - COLD!
  int r1 = 18;
  int g1 = 228;
  int b1 = 232;

  //RED - HOT!
  int r2 = 232;
  int g2 = 18;
  int b2 = 68;

  int rValue = r1 + ((r2 - r1) * (difference / 100.0));
  int gValue = g1 + ((g2 - g1) * (difference / 100.0));
  int bValue = b1 + ((b2 - b1) * (difference / 100.0));

  return String(rValue, HEX) + String(gValue, HEX) + String(bValue, HEX);
}

void handleRoot() {
  float temperature = getTemperature();  
  String colour = getInterpolatedColour(temperature);
  String result="<html> <head> <style> html{ background:-webkit-radial-gradient(circle, #ffffff 0%,#"+getInterpolatedColour(temperature )+" 100%); height:100%; width:100%; } /* Thermometer column and text */ .thermometer{ margin-top: 30px; margin-left: 50%; left: -11px; width:22px; height:150px; display:block; font:bold 14px/152px helvetica, arial, sans-serif; text-indent: 36px; background: -webkit-linear-gradient(top, #fff 0%, #fff 50%, #db3f02 80%, #db3f02 100%); border-radius:22px 22px 0 0; border:5px solid #4a1c03; border-bottom:none; position:absolute; box-shadow:inset 0 0 0 4px #fff; color:#4a1c03; } /* Thermometer Bulb */ .thermometer:before{ content:' '; width:44px; height:44px; display:block; position:absolute; top:142px; left:-16px; z-index:-1; /* Place the bulb under the column */ background:#db3f02; border-radius:44px; border:5px solid #4a1c03; box-shadow:inset 0 0 0 4px #fff; } /* This piece here connects the column with the bulb */ .thermometer:after{ content:' '; width:14px; height:7px; display:block; position:absolute; top:146px; left:4px; background:#db3f02; } </style> <body> <script> var w = window.innerWidth; var h = window.innerHeight; setTimeout(function(){ window.location.reload(1); }, 1000 * 60 * 2); </script> <span class='thermometer'>" + String(temperature) + "&deg;C</span> </body> </html>";
  server.send(200, "text/html", result);
}

void handleReset() {
  averageTemp = 0;
  averageHumidity = 0;
  count = 0;
  server.send(200, "text/html", "Success");
}

void handleAverage() {
  server.send(200, "text/html", "{\"average\": " + String(averageTemp) + ", \"humidity\": " + String(averageHumidity) + ", \"mac\": \"" + macAddr + "\"}");
  averageTemp = 0;
  averageHumidity = 0;
  count = 0;
}

void handleTemperature() {
  server.send(200, "text/html", "{\"temperature\": " + String(averageTemp) + ", \"humidity\": " + String(averageHumidity) + "}");
}

void handleBlink() {  
  blinkCount = 2000;
  server.send(200, "text/html", "Blinking!");
}

void handleNotFound(){
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += server.uri();
  message += "\nMethod: ";
  message += (server.method() == HTTP_GET)?"GET":"POST";
  message += "\nArguments: ";
  message += server.args();
  message += "\n";
  for (uint8_t i=0; i<server.args(); i++){
    message += " " + server.argName(i) + ": " + server.arg(i) + "\n";
  }
  server.send(404, "text/plain", message);
}

void setColour(int red, int green, int blue)
{
  analogWrite(RED_PIN, red);
  analogWrite(GREEN_PIN, green);
  analogWrite(BLUE_PIN, blue);  
}

int hexToInt(String hex) {
  int value = 0;
  int a = 0;
  int b = hex.length() - 1;
  for (; b >= 0; a++, b--) {
    if (hex[b] >= '0' && hex[b] <= '9') {
      value += (hex[b] - '0') * (1 << (a * 4));
      } else {
        value += ((hex[b] - 'A') + 10) * (1 << (a * 4));
      }
    }
    return value;
}

void setColour(String hex)
{
  hex.toUpperCase();
  String redString = hex.substring(0, 2);
  String greenString = hex.substring(2, 4);
  String blueString = hex.substring(4, 6);
      
  setColour(hexToInt(redString), hexToInt(greenString), hexToInt(blueString));
}

float getTemperature(){
 //returns the temperature in Celsius
 int chk = DHT.read11(DHT11_PIN);
 return DHT.temperature;
}

float getHumidity(){
 //returns the temperature in Celsius
 int chk = DHT.read11(DHT11_PIN);
 return DHT.humidity;
}

String macToStr(const uint8_t* mac) {
  String result;
  for (int i = 0; i < 6; ++i) {
    result += String(mac[i], 16);
    if (i < 5)
      result += ':';
  }
  return result;
}

//https://techtutorialsx.com/2016/07/17/esp8266-http-get-requests/
void registerDevice(String deviceMacAddress, String ipAddress) {  
  String url = "http://" + HOST_ADDRESS + ":" + HOST_PORT + "/register?mac=" + deviceMacAddress + "&ip=" + ipAddress;
  Serial.println("URL: " + url);
  http.begin(url);  //Specify request destination
  int httpCode = http.GET(); //Send the request
  if (httpCode > 0) {      //Check the returning code      
    String payload = http.getString();   //Get the request response payload
    Serial.println("PAYLOAD: " + payload);             //Print the response payload
    colour = payload;
    registered = true;
  } else {
    registered = false;
    colour = "550000";
    Serial.println("HTTP response code: " + String(httpCode));
  }
  http.end();   //Close connection  
}

void updateAverage(float temperature, float humidity) {
  if (temperature < -125 || temperature > 125) return;
  count = (count % INT_MAX) + 1;
  averageTemp -= averageTemp / count;
  averageTemp += temperature / count;

  averageHumidity -= averageHumidity / count;
  averageHumidity += humidity / count;
}

void loop() {
  server.handleClient();
  updateAverage(getTemperature(), getHumidity());

  if (blinkCount > 0) {
    blinkCount = blinkCount - 10;
    if (blinkCount % 50 == 0) {
      setColour(colour);
    } else {
      setColour("000000");
    }
  } else {
    setColour(colour);
  }
  
  delay(10); 
}

