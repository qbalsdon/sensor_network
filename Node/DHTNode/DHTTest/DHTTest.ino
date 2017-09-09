#include "dht.h"

#define BLUE_PIN D6
#define GREEN_PIN D5
#define RED_PIN D4
#define DHT11_PIN D3
#define INT_MAX 214748364

String red = "990000";
String green = "009900";
String blue = "000099";
String colour = red;

dht DHT;

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

void setup(){
  Serial.begin(115200);
  Serial.println("");
  Serial.println("Hello ESP8266");
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  setColour(colour);
  digitalWrite(LED_BUILTIN, LOW);
}

void loop()
{
  int chk = DHT.read11(DHT11_PIN);
  Serial.print("Temperature = ");
  Serial.println(DHT.temperature);
  Serial.print("Humidity = ");
  Serial.println(DHT.humidity);

  if (colour == red) colour = blue;
  else if (colour == blue) colour = green;
  else if (colour == green) colour = red;
  
  setColour(colour);
  delay(1000);
}

