cmake_minimum_required(VERSION 3.20)
project(minilibs C)

set(CMAKE_C_FLAGS "-std=c99 -pedantic -Wall -DTEST")

include_directories(.)

add_executable(regexp regexp.c)

#add_executable()
