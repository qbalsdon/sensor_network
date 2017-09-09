NOTE: You need to delare a constants.h file that looks like this:

    #ifndef Constants_h
    #define Constants_h

    static const char* WIFI_SSID = "";     //YOUR WIFI SSID
    static const char* WIFI_PASS = "";     //YOUR WIFI PASSWORD
    static const String HOST_ADDRESS = ""; //THE RASPBERRY PI HOST IP ADDRESS
    static const String HOST_PORT = "";    //THE PORT YOU ARE USING, DEFAULT 3000
#endif
