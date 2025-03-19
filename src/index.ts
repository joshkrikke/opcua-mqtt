/*
* index.ts
*/
import * as opcua from 'node-opcua-client';
import * as mqtt from 'mqtt';
import { Configuration } from "./config";
import { iMQTTPayload } from "./interfaces";
var config:any;


async function handleDataReceived (
    tagname:string, 
    dataValue:opcua.DataValue,
    mqttclient:mqtt.MqttClient,
    tags:string[], 
    topics:string[] ) {

    //find out which tag it is
    let index:number = tags.indexOf(tagname);

    //find out topic name with index of tag
    let topicname:string = topics[index];

    //setup topic with basetopic and topicname
    let topic:string = config.mqtt.baseTopic + topicname;

    //validate payload with interface
    let payload:iMQTTPayload = {
        timestamp: dataValue.serverTimestamp?.toISOString(),
        value: dataValue.value.value.toString()
        };

    // publish to the MQTT broker
    await mqttclient.publishAsync(topic, JSON.stringify(payload));
    console.log ("published: ", topic, " with payload: ", JSON.stringify(payload));
}




function setupTagSubscriptions (
    subscription:opcua.ClientSubscription, 
    tag:string, 
    mqtt:mqtt.MqttClient,
    tags:string[],          // tags and topics arrays for mapping the topic name 
    topics:string[]){

    let nodeID:string = "ns=1;s=" + tag; //build nodeID

    let monitoringParameters = {
        "samplingInterval": 1000, // in future, could be in config.json
        "discardOldest": true,
        "queueSize": 10
    };

    // configure monitoring for the requested tag
    let monitoredItem = opcua.ClientMonitoredItem.create(subscription, {nodeId: nodeID,attributeId: opcua.AttributeIds.Value},monitoringParameters,opcua.TimestampsToReturn.Both);

    // set up handler for subscribed object data change
    monitoredItem.on("changed", (dataValue: opcua.DataValue) => {
        let tagname:string = monitoredItem.itemToMonitor.nodeId.value.toString();
        handleDataReceived (tagname, dataValue,mqtt,tags,topics);
    }); 
}


async function main(){

    //reading the config, tags and topics arrays (they match via index) are in the config 
    let configFileName:string = Configuration.setConfigurationFilename('config.json'); // set file name
    config = Configuration.readFileAsJSON(configFileName); // read config file
    let tags:string[] = config.tags; 
    let topics:string[] = config.topics; 
    

    try {

        // connect to mqtt-broker
        let url:string = config.mqtt.brokerUrl + ":" + config.mqtt.mqttPort;
        const mqttclient:mqtt.MqttClient = await mqtt.connectAsync(url);
        console.log ("mqtt connected!");
        
        // create a client based on our configuration details
        const opcClient = opcua.OPCUAClient.create (config.opc.connection);

        // create a connection to OPC-UA endpoint
        await opcClient.connect (config.opc.endpoint);
        console.log ("connected to OPC UA Server at: ", config.opc.endpoint);
    
        // create opc-ua session
        let session = await opcClient.createSession();

        // create client subscription
        const subscription = opcua.ClientSubscription.create(session,config.opc.subscription.parameters);
        console.log("Subscription created.");

        // setup subscriptions for each tag
        for (let tagIndex:number = 0; tagIndex < tags.length; tagIndex++) {
            setupTagSubscriptions (subscription, tags[tagIndex],mqttclient,tags,topics); // call setupTagSubscriptions with each element of tags[]
        }
        
        // set up asynchronous disconnection support via signals
        const shutdown = async() => {
            console.log ("disconnecting our services now");
            await opcClient.disconnect();
            await mqttclient.endAsync();
            // TODO: add in other requests to disconnect from services
            process.exit();
        }
        process.on ('SIGINT', shutdown);
        process.on ('SIGTERM', shutdown);
    
    } catch (err) {
        console.log ("Error: ", err);
    }

}

main();