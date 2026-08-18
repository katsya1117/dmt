<?php
require_once __DIR__ . "/Services/HelloWorldService.php";
$service = new HelloWorldService();
var_dump($service->ShowHello());
var_dump($service->callCarInformation("001"));
